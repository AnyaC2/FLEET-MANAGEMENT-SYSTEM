import { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import {
  downloadImportTemplate,
  downloadLegacyImportSampleWorkbook,
  executeWorkbookImport,
  getImportFieldSuggestions,
  importSheetFieldDefinitions,
  importSheetOptions,
  parseImportWorkbook,
  type ImportExecutionResult,
  type ImportIssue,
  type ImportSheetKey,
  type ImportWorkbookPreview,
} from '@/lib/data-import';
import { listImportBatches, recordImportBatch } from '@/lib/import-history';
import type { ImportBatch } from '@/types';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  RefreshCcw,
  Upload,
} from 'lucide-react';

const supportedSheets = [
  'Vehicles',
  'Drivers',
  'Assignments',
  'Fuel Logs',
  'Maintenance',
  'Incidents',
  'Trips',
];

const resultLabels: Record<string, string> = {
  vehicles: 'Vehicles',
  drivers: 'Drivers',
  assignments: 'Assignments',
  fuelLogs: 'Fuel Logs',
  maintenance: 'Maintenance',
  incidents: 'Incidents',
  trips: 'Trips',
};

function IssueBadge({ severity }: { severity: ImportIssue['severity'] }) {
  if (severity === 'error') {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        Error
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
      Warning
    </Badge>
  );
}

export default function DataImport() {
  const { canManageRecords, user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportWorkbookPreview | null>(null);
  const [result, setResult] = useState<ImportExecutionResult | null>(null);
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, Record<string, string>>>({});
  const [sheetOverrides, setSheetOverrides] = useState<Record<string, ImportSheetKey | 'ignore'>>({});
  const [expandedColumnMappingSheets, setExpandedColumnMappingSheets] = useState<Record<string, boolean>>({});
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const errorCount = preview?.issues.filter((item) => item.severity === 'error').length ?? 0;
  const warningCount = preview?.issues.filter((item) => item.severity === 'warning').length ?? 0;

  const resultTotals = useMemo(() => {
    if (!result) {
      return { created: 0, skipped: 0 };
    }

    return {
      created: Object.values(result.created).reduce((sum, value) => sum + value, 0),
      skipped: Object.values(result.skipped).reduce((sum, value) => sum + value, 0),
    };
  }, [result]);

  const visibleIssues = preview?.issues.slice(0, 20) ?? [];
  const visibleResultIssues = result?.issues.slice(0, 20) ?? [];
  const selectedHistoryBatch = useMemo(
    () => importHistory.find((batch) => batch.id === selectedBatchId) ?? importHistory[0] ?? null,
    [importHistory, selectedBatchId]
  );

  const sumCounts = (counts: Record<string, number>) =>
    Object.values(counts).reduce((sum, value) => sum + value, 0);

  const getSheetFieldIssueKeys = (sheet: ImportWorkbookPreview['sheets'][number]) => {
    const relevantIssues = preview?.issues.filter((item) => item.sheet === sheet.label) ?? [];

    return new Set(
      importSheetFieldDefinitions[sheet.key]
        .filter((field) =>
          relevantIssues.some((issue) => issue.message.toLowerCase().includes(field.label.toLowerCase()))
        )
        .map((field) => field.key)
    );
  };

  useEffect(() => {
    if (!canManageRecords) {
      return;
    }

    void loadImportHistory();
  }, [canManageRecords]);

  const loadImportHistory = async () => {
    setIsLoadingHistory(true);

    try {
      const batches = await listImportBatches(6);
      setImportHistory(batches);
      setSelectedBatchId((current) => current ?? batches[0]?.id ?? null);
    } catch (error) {
      console.error('Failed to load import history', error);
      toast.error('Could not load recent import history right now.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatImportTimestamp = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(null);
    setResult(null);
    setColumnOverrides({});
    setExpandedColumnMappingSheets({});
    setSheetOverrides({});
  };

  const runPreview = async (
    file: File,
    overrides: Record<string, ImportSheetKey | 'ignore'> = sheetOverrides,
    nextColumnOverrides: Record<string, Record<string, string>> = columnOverrides
  ) => {
    setIsParsing(true);
    setResult(null);

    try {
      const parsedPreview = await parseImportWorkbook(file, {
        sheetOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        columnOverrides: Object.keys(nextColumnOverrides).length > 0 ? nextColumnOverrides : undefined,
      });
      setPreview(parsedPreview);

      if (parsedPreview.canImport) {
        toast.success(`Preview ready. ${parsedPreview.validRows} rows are ready to import.`);
      } else {
        toast.error('Preview found issues that need attention before import.');
      }
    } catch (error) {
      console.error('Failed to parse import workbook', error);
      toast.error('Could not read that workbook. Please use the provided template or a valid Excel file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error('Choose an Excel workbook first.');
      return;
    }

    await runPreview(selectedFile);
  };

  const handleSheetOverrideChange = async (sheetName: string, value: string) => {
    const nextOverrides = {
      ...sheetOverrides,
      [sheetName]: value as ImportSheetKey | 'ignore',
    };

    setSheetOverrides(nextOverrides);

    if (!selectedFile) {
      return;
    }

    await runPreview(selectedFile, nextOverrides, columnOverrides);
  };

  const handleColumnOverrideChange = async (sheetName: string, fieldKey: string, value: string) => {
    const nextColumnOverrides = { ...columnOverrides };
    const nextSheetOverrides = { ...(nextColumnOverrides[sheetName] ?? {}) };

    if (value === '__auto__') {
      delete nextSheetOverrides[fieldKey];
    } else {
      nextSheetOverrides[fieldKey] = value;
    }

    if (Object.keys(nextSheetOverrides).length === 0) {
      delete nextColumnOverrides[sheetName];
    } else {
      nextColumnOverrides[sheetName] = nextSheetOverrides;
    }

    setColumnOverrides(nextColumnOverrides);

    if (!selectedFile) {
      return;
    }

    await runPreview(selectedFile, sheetOverrides, nextColumnOverrides);
  };

  const toggleExpandedColumnMappingSheet = (sheetName: string) => {
    setExpandedColumnMappingSheets((current) => ({
      ...current,
      [sheetName]: !current[sheetName],
    }));
  };

  const handleImport = async () => {
    if (!preview?.canImport) {
      toast.error('Resolve the preview errors before importing.');
      return;
    }

    setIsImporting(true);

    try {
      const executionResult = await executeWorkbookImport(preview);
      setResult(executionResult);
      const savedBatch = await recordImportBatch({
        preview,
        result: executionResult,
        importedBy: user ? { id: user.id, name: user.name } : null,
      });
      setImportHistory((current) => [savedBatch, ...current.filter((item) => item.id !== savedBatch.id)].slice(0, 6));
      setSelectedBatchId(savedBatch.id);
      toast.success('Import finished successfully.');
    } catch (error) {
      console.error('Failed to import workbook', error);
      toast.error('Import could not be completed. Check the import history before trying again.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!canManageRecords) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="lfz-enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-gray-900 sm:text-[2.25rem]">Data import</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gray-500">
            Bring your existing Excel records into the fleet register. You can review them before anything is saved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadImportTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Download template
          </Button>
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2 border-y border-gray-200 py-4 sm:flex sm:gap-8" aria-label="Import progress">
        {['Choose file', 'Review', 'Import'].map((step, index) => {
          const currentStep = result ? 2 : preview ? 1 : 0;
          return (
            <li key={step} aria-current={index === currentStep ? 'step' : undefined} className={`flex items-center gap-2 text-xs sm:text-sm ${index === currentStep ? 'font-semibold text-primary' : 'text-gray-500'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${index <= currentStep ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>{index + 1}</span>
              {step}
            </li>
          );
        })}
      </ol>

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload spreadsheet
          </CardTitle>
          <CardDescription>
            Excel files (.xlsx or .xls). For Google Sheets, download a copy as Microsoft Excel first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <label htmlFor="import-workbook" className="text-sm font-medium text-gray-900">Spreadsheet file</label>
              </div>
              <Input
                id="import-workbook"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isParsing || isImporting}
                className="max-w-sm bg-white"
              />
            </div>
            {selectedFile ? (
              <div className="mt-4 rounded-xl bg-white p-4 text-sm text-gray-700 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center gap-2 font-medium text-gray-900">
                  <Upload className="h-4 w-4 text-primary" />
                  {selectedFile.name}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB ready for validation.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePreview} disabled={!selectedFile || isParsing || isImporting} className="gap-2">
              <RefreshCcw className={`h-4 w-4 ${isParsing ? 'animate-spin' : ''}`} />
              {isParsing ? 'Checking records...' : 'Review records'}
            </Button>
            <Button
              variant="outline"
              disabled={!preview?.canImport || isParsing || isImporting || Boolean(result)}
              onClick={handleImport}
              className="gap-2"
            >
              <Database className="h-4 w-4" />
              {isImporting ? 'Importing...' : result ? 'Import complete' : 'Import records'}
            </Button>
          </div>

          <p className="text-sm text-gray-500">Duplicate records are skipped. Nothing is saved until you select Import records.</p>
        </CardContent>
      </Card>

      <details className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Preparing your file</summary>
          <Accordion type="multiple" className="mt-3 w-full">
            <AccordionItem value="format">
              <AccordionTrigger>Workbook format</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {supportedSheets.map((sheet) => (
                    <Badge key={sheet} variant="outline" className="border-slate-200 bg-white text-slate-700">
                      {sheet}
                    </Badge>
                  ))}
                </div>
                <div className="rounded-2xl border border-[#15247f]/15 bg-[#f1f3fa] p-4 text-sm text-[#15247f]">
                  Legacy tab names like fleet registers, driver lists, trip logs, and similar column labels are recognized automatically when possible.
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>Document files are not part of this importer yet. This version is focused on structured fleet records.</div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="pilot">
              <AccordionTrigger>Recommended first trial</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-gray-600">
                <p>Keep a backup of your spreadsheet and start with a small file. Review any flagged rows before importing.</p>
                <Button variant="outline" size="sm" onClick={downloadLegacyImportSampleWorkbook}>Download example spreadsheet</Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <p className="mt-3 text-sm leading-6 text-gray-600">After importing, check a few records in Vehicles or Drivers. The import history below keeps the results and any skipped rows.</p>
      </details>

      {preview ? (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Preview Summary
              </CardTitle>
              <CardDescription>{preview.fileName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Rows detected</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{preview.totalRows}</p>
                </div>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-green-700">Rows ready</p>
                  <p className="mt-2 text-2xl font-semibold text-green-900">{preview.validRows}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Issues</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-900">{preview.issues.length}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sheet</TableHead>
                    <TableHead>Detected name</TableHead>
                    <TableHead className="text-right">Rows found</TableHead>
                    <TableHead className="text-right">Valid rows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.sheets.map((sheet) => (
                    <TableRow key={sheet.key}>
                      <TableCell className="font-medium">{sheet.label}</TableCell>
                      <TableCell>{sheet.detectedSheetName}</TableCell>
                      <TableCell className="text-right">{sheet.sourceRows}</TableCell>
                      <TableCell className="text-right">{sheet.validRows}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-wrap gap-3">
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  {errorCount} errors
                </Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  {warningCount} warnings
                </Badge>
                <Badge variant="outline" className={preview.canImport ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-100 text-slate-700'}>
                  {preview.canImport ? 'Ready to import' : 'Fix errors before import'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Validation Details</CardTitle>
              <CardDescription>
                Showing the first {visibleIssues.length} issue{visibleIssues.length === 1 ? '' : 's'} from this workbook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleIssues.length === 0 ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  No validation issues were found. This workbook is ready to import.
                </div>
              ) : (
                visibleIssues.map((item, index) => (
                  <div key={`${item.sheet}-${item.row}-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <IssueBadge severity={item.severity} />
                      <span className="text-sm font-medium text-gray-900">
                        {item.sheet}
                        {item.row > 0 ? ` · Row ${item.row}` : ''}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{item.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {preview?.unmatchedSheets.length ? (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Legacy Sheet Mapping</CardTitle>
            <CardDescription>
              These workbook tabs were not recognized automatically. Map each one to the right record type or ignore it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.unmatchedSheets.map((sheet) => (
              <div key={sheet.sheetName} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{sheet.sheetName}</p>
                      <p className="text-xs text-gray-500">{sheet.sourceRows} row{sheet.sourceRows === 1 ? '' : 's'} detected</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sheet.headers.length > 0 ? (
                        sheet.headers.map((header) => (
                          <Badge key={`${sheet.sheetName}-${header}`} variant="outline" className="border-slate-200 bg-white text-slate-700">
                            {header}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">No header row detected.</span>
                      )}
                    </div>
                    {sheet.suggestedKey ? (
                      <p className="text-xs text-[#15247f]">
                        Best guess: {importSheetOptions.find((option) => option.value === sheet.suggestedKey)?.label ?? sheet.suggestedKey}
                      </p>
                    ) : null}
                  </div>

                  <div className="w-full max-w-xs space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Map this sheet as</p>
                    <Select
                      value={sheetOverrides[sheet.sheetName] ?? ''}
                      onValueChange={(value) => void handleSheetOverrideChange(sheet.sheetName, value)}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Choose a record type" />
                      </SelectTrigger>
                      <SelectContent>
                        {importSheetOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="ignore">Ignore Sheet</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Choosing a mapping refreshes the preview automatically.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {preview?.sheets.length ? (
        <Card className="border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Column Mapping</CardTitle>
            <CardDescription>
              Optional fallback for legacy headers. The importer now prioritizes fields that are required or currently failing validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.sheets.map((sheet) => {
              const fieldDefinitions = importSheetFieldDefinitions[sheet.key];
              const suggestedFields = getImportFieldSuggestions(sheet.key, sheet.headers);
              const issueFieldKeys = getSheetFieldIssueKeys(sheet);
              const mappedCount = Object.keys(columnOverrides[sheet.detectedSheetName] ?? {}).length;
              const showAllFields = expandedColumnMappingSheets[sheet.detectedSheetName] ?? false;
              const prioritizedFields = fieldDefinitions.filter(
                (field) =>
                  field.required ||
                  issueFieldKeys.has(field.key) ||
                  Boolean(columnOverrides[sheet.detectedSheetName]?.[field.key])
              );
              const visibleFields =
                showAllFields || prioritizedFields.length === 0 ? fieldDefinitions : prioritizedFields;

              return (
                <div key={`${sheet.detectedSheetName}-${sheet.key}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{sheet.detectedSheetName}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Mapped as {sheet.label}. {mappedCount} manual field override{mappedCount === 1 ? '' : 's'} applied.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                      {sheet.headers.length} column{sheet.headers.length === 1 ? '' : 's'} detected
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {sheet.headers.length > 0 ? (
                      sheet.headers.slice(0, 10).map((header) => (
                        <Badge
                          key={`${sheet.detectedSheetName}-${header}`}
                          variant="outline"
                          className="border-slate-200 bg-white text-slate-700"
                        >
                          {header}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">No header row detected for this sheet.</span>
                    )}
                  </div>

                  {sheet.headers.length > 0 ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                          Showing {visibleFields.length} of {fieldDefinitions.length} field
                          {fieldDefinitions.length === 1 ? '' : 's'} for {sheet.label}.
                        </p>
                        {prioritizedFields.length > 0 && prioritizedFields.length < fieldDefinitions.length ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => toggleExpandedColumnMappingSheet(sheet.detectedSheetName)}
                          >
                            {showAllFields ? 'Show only key fields' : 'Show all fields'}
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {visibleFields.map((field) => {
                          const suggestedHeader = suggestedFields[field.key];
                          const selectedHeader = columnOverrides[sheet.detectedSheetName]?.[field.key];
                          const isProblemField = issueFieldKeys.has(field.key);

                          return (
                        <div key={`${sheet.detectedSheetName}-${field.key}`} className="rounded-xl bg-white p-3 ring-1 ring-gray-100">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{field.label}</p>
                            {field.required ? (
                              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                                Required
                              </Badge>
                            ) : null}
                            {isProblemField ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                Needs attention
                              </Badge>
                            ) : null}
                          </div>
                          <Select
                            value={selectedHeader ?? '__auto__'}
                            onValueChange={(value) =>
                              void handleColumnOverrideChange(sheet.detectedSheetName, field.key, value)
                            }
                          >
                            <SelectTrigger className="mt-3 w-full bg-white">
                              <SelectValue placeholder="Auto-detect column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__auto__">Auto-detect</SelectItem>
                              {sheet.headers.map((header) => (
                                <SelectItem key={`${sheet.detectedSheetName}-${field.key}-${header}`} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {suggestedHeader && selectedHeader !== suggestedHeader ? (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#15247f]/15 bg-[#f1f3fa] px-3 py-2">
                              <p className="text-xs text-[#15247f]">Suggested match: {suggestedHeader}</p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  void handleColumnOverrideChange(
                                    sheet.detectedSheetName,
                                    field.key,
                                    suggestedHeader
                                  )
                                }
                              >
                                Use
                              </Button>
                            </div>
                          ) : null}
                        </div>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Last Import Result</CardTitle>
              <CardDescription>
                {resultTotals.created} record{resultTotals.created === 1 ? '' : 's'} created, {resultTotals.skipped}{' '}
                skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(result.created).map(([key, createdCount]) => (
                <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">{resultLabels[key] ?? key}</p>
                  <p className="mt-2 text-sm text-gray-600">Created: {createdCount}</p>
                  <p className="text-sm text-gray-600">Skipped: {result.skipped[key as keyof typeof result.skipped]}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Import Warnings</CardTitle>
              <CardDescription>
                Showing the first {visibleResultIssues.length} issue{visibleResultIssues.length === 1 ? '' : 's'} from the last import.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleResultIssues.length === 0 ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  Import completed without any skipped rows or follow-up warnings.
                </div>
              ) : (
                visibleResultIssues.map((item, index) => (
                  <div key={`${item.sheet}-${item.row}-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <IssueBadge severity={item.severity} />
                      <span className="text-sm font-medium text-gray-900">
                        {item.sheet}
                        {item.row > 0 ? ` · Row ${item.row}` : ''}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{item.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="border-0 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Import history</CardTitle>
          <CardDescription>Previous files, results and skipped rows.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="history">
              <AccordionTrigger>Open import history</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <Card className="border border-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Import History</CardTitle>
                      <CardDescription>
                        Saved audit trail for the latest workbook imports, including counts and row-level warnings.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isLoadingHistory ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          Loading recent import history...
                        </div>
                      ) : importHistory.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          No import batches have been recorded yet.
                        </div>
                      ) : (
                        importHistory.map((batch) => {
                          const isSelected = selectedHistoryBatch?.id === batch.id;

                          return (
                            <button
                              key={batch.id}
                              type="button"
                              onClick={() => setSelectedBatchId(batch.id)}
                              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/15'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
                              }`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{batch.fileName}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    Imported {formatImportTimestamp(batch.importedAt)}
                                    {batch.importedByName ? ` by ${batch.importedByName}` : ''}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={
                                    isSelected
                                      ? 'border-primary/30 bg-white text-primary'
                                      : 'border-slate-200 bg-white text-slate-700'
                                  }
                                >
                                  {isSelected ? 'Viewing details' : 'Open details'}
                                </Badge>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                                  {sumCounts(batch.created)} created
                                </Badge>
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                  {sumCounts(batch.skipped)} skipped
                                </Badge>
                                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                                  {batch.issueCount} issues
                                </Badge>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border border-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">Batch Details</CardTitle>
                      <CardDescription>
                        Full sheet summary and row-level outcomes for the selected import batch.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedHistoryBatch ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          Select an import batch to inspect its details.
                        </div>
                      ) : (
                        <>
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-base font-semibold text-gray-900">{selectedHistoryBatch.fileName}</p>
                                <p className="mt-1 text-sm text-gray-500">
                                  Imported {formatImportTimestamp(selectedHistoryBatch.importedAt)}
                                  {selectedHistoryBatch.importedByName ? ` by ${selectedHistoryBatch.importedByName}` : ''}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                                  {sumCounts(selectedHistoryBatch.created)} created
                                </Badge>
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                  {sumCounts(selectedHistoryBatch.skipped)} skipped
                                </Badge>
                                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                                  {selectedHistoryBatch.issueCount} issues
                                </Badge>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-100">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Workbook rows</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{selectedHistoryBatch.totalRows}</p>
                              </div>
                              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-100">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Rows imported</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{selectedHistoryBatch.validRows}</p>
                              </div>
                              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-100">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Sheets detected</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{selectedHistoryBatch.sheets.length}</p>
                              </div>
                            </div>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Sheet</TableHead>
                                <TableHead>Detected name</TableHead>
                                <TableHead className="text-right">Rows found</TableHead>
                                <TableHead className="text-right">Valid rows</TableHead>
                                <TableHead className="text-right">Created</TableHead>
                                <TableHead className="text-right">Skipped</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedHistoryBatch.sheets.map((sheet) => (
                                <TableRow key={`${selectedHistoryBatch.id}-${sheet.key}`}>
                                  <TableCell className="font-medium">{sheet.label}</TableCell>
                                  <TableCell>{sheet.detectedSheetName}</TableCell>
                                  <TableCell className="text-right">{sheet.sourceRows}</TableCell>
                                  <TableCell className="text-right">{sheet.validRows}</TableCell>
                                  <TableCell className="text-right">
                                    {selectedHistoryBatch.created[sheet.key] ?? 0}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {selectedHistoryBatch.skipped[sheet.key] ?? 0}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Recorded Issues</p>
                              <p className="text-sm text-gray-500">
                                {selectedHistoryBatch.issues.length === 0
                                  ? 'This batch completed without any recorded issues.'
                                  : `Showing all ${selectedHistoryBatch.issues.length} recorded issue${selectedHistoryBatch.issues.length === 1 ? '' : 's'}.`}
                              </p>
                            </div>

                            {selectedHistoryBatch.issues.length === 0 ? (
                              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                                This import completed cleanly without any saved warnings.
                              </div>
                            ) : (
                              selectedHistoryBatch.issues.map((item, index) => (
                                <div
                                  key={`${selectedHistoryBatch.id}-${item.sheet}-${item.row}-${index}`}
                                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <IssueBadge severity={item.severity} />
                                    <span className="text-sm font-medium text-gray-900">
                                      {item.sheet}
                                      {item.row > 0 ? ` · Row ${item.row}` : ''}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm text-gray-600">{item.message}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { searchLocations } from '@/lib/location-search';
import type { LocationSuggestion } from '@/lib/location-search';

interface LocationAutocompleteInputProps {
  id: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChangeText: (value: string) => void;
  onLocationSelect: (location: LocationSuggestion | null) => void;
}

export function LocationAutocompleteInput({
  id,
  value,
  placeholder,
  disabled,
  onChangeText,
  onLocationSelect,
}: LocationAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const trimmedValue = value.trim();

    if (trimmedValue.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      void searchLocations(trimmedValue, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setIsOpen(true);
        })
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') {
            setSuggestions([]);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [value]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          onLocationSelect(null);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Searching locations...</div>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={`${suggestion.latitude}-${suggestion.longitude}-${suggestion.label}`}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeText(suggestion.label);
                  onLocationSelect(suggestion);
                  setIsOpen(false);
                }}
              >
                {suggestion.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

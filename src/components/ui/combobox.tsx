
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "./scroll-area"

interface ComboboxProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  inputPlaceholder?: string
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  emptyMessage = "No option found.",
  inputPlaceholder = "Search or type...",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("") // To handle direct input

  const handleSelect = (currentValue: string) => {
    const selectedOption = options.find(
      (option) => option.value.toLowerCase() === currentValue.toLowerCase()
    )
    if (selectedOption) {
      onChange(selectedOption.value)
      setInputValue(selectedOption.label)
    } else {
      // Allow new value if not found in options
      onChange(currentValue)
      setInputValue(currentValue)
    }
    setOpen(false)
  }
  
  // Effect to sync inputValue with prop value if it changes externally
  // or if it's one of the options.
  React.useEffect(() => {
    const currentOption = options.find(opt => opt.value === value);
    if (currentOption) {
      setInputValue(currentOption.label);
    } else if (value) { // If value is set but not in options, assume it's a custom typed value
      setInputValue(value);
    } else {
      setInputValue(""); // Clear if value is cleared
    }
  }, [value, options]);


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className={cn(className)}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {inputValue || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false} > {/* Custom filtering logic is handled */}
          <CommandInput 
            placeholder={inputPlaceholder}
            value={inputValue}
            onValueChange={(search) => {
              setInputValue(search) // Update input field as user types
              // Optionally, you could trigger onChange here if you want real-time updates as user types new values
              // For now, onChange is only called on select or blur/enter if it's a new value
            }}
            onBlur={() => { // If input loses focus, and it's a new value, set it
                if (inputValue && !options.find(opt => opt.label.toLowerCase() === inputValue.toLowerCase())) {
                    onChange(inputValue);
                }
            }}
            onKeyDown={(e) => { // If user presses Enter and it's a new value, set it
                if (e.key === 'Enter' && inputValue && !options.find(opt => opt.label.toLowerCase() === inputValue.toLowerCase())) {
                    e.preventDefault();
                    onChange(inputValue);
                    setOpen(false);
                }
            }}
          />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandList>
            <ScrollArea className="max-h-60">
            {inputValue && !options.find(opt => opt.label.toLowerCase() === inputValue.toLowerCase()) && (
                 <CommandItem
                    key={`new-${inputValue}`}
                    value={inputValue}
                    onSelect={() => handleSelect(inputValue)}
                    className="cursor-pointer"
                >
                    <Check
                    className={cn(
                        "mr-2 h-4 w-4",
                        value === inputValue ? "opacity-100" : "opacity-0"
                    )}
                    />
                    Create new: "{inputValue}"
              </CommandItem>
            )}
            {options
              .filter(option => option.label.toLowerCase().includes(inputValue.toLowerCase()))
              .map((option) => (
              <CommandItem
                key={option.value}
                value={option.label} // Use label for CommandItem's internal value matching
                onSelect={() => {
                    handleSelect(option.value)
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

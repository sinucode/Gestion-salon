import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"

export interface Option {
  label: string
  value: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  emptyText?: string
  className?: string
  icon?: React.ReactNode
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar opciones",
  emptyText = "Sin resultados.",
  className,
  icon
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (currentValue: string) => {
    // Determine if it's already selected
    const isSelected = selected.includes(currentValue)
    
    // "all" special option behavior
    if (currentValue === "all") {
        if (isSelected) {
            onChange([]) // Deselect all
        } else {
            onChange([]) // selecting "all" clears specific selections to mean "everything"
        }
        return
    }

    if (isSelected) {
      onChange(selected.filter((item) => item !== currentValue))
    } else {
      onChange([...selected, currentValue])
    }
  }

  // Treat empty array as "all" for display
  const isAll = selected.length === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between overflow-hidden cursor-pointer", className)}
      >
        <div className="flex items-center gap-2 truncate">
          {icon}
          {isAll ? (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          ) : (
              <div className="flex items-center gap-1 overflow-hidden truncate h-full">
                  {selected.length === 1 ? (
                      <span className="truncate">
                          {options.find(o => o.value === selected[0].replace(/['"]/g, ''))?.label 
                            || selected[0].replace(/['"]/g, '')}
                      </span>
                  ) : (
                      <Badge variant="secondary" className="px-1.5 py-0 h-5 font-normal truncate">
                          {selected.length} seleccionadas
                      </Badge>
                  )}
              </div>
          )}
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={handleSelect}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    isAll ? "opacity-100" : "opacity-0"
                  )}
                />
                Todas (Consolidado)
              </CommandItem>
              {options.map((option) => {
                const isSelected = selected.some(s => s.replace(/['"]/g, '') === option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleSelect}
                    className="cursor-pointer font-normal"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

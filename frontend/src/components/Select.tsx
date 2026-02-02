import React from "react";
import Select, { type StylesConfig, type GroupBase, type MultiValue, type SingleValue } from "react-select";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string | string[] | null;
  onChange: (value: string | string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  isMulti?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
}

const customStyles: StylesConfig<SelectOption, boolean, GroupBase<SelectOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: "2.5rem",
    borderColor: state.isFocused ? "var(--color-accent)" : "var(--color-border)",
    boxShadow: state.isFocused ? "var(--focus-ring)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-accent)" : "var(--color-accent-tint)",
    },
    backgroundColor: state.isDisabled ? "var(--color-surface-muted)" : "var(--color-surface)",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "var(--color-accent-tint)",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "var(--color-accent)",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "var(--color-accent)",
    "&:hover": {
      backgroundColor: "var(--color-accent)",
      color: "var(--color-on-accent)",
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--color-accent)"
      : state.isFocused
        ? "var(--color-accent-tint)"
        : "var(--color-surface)",
    color: state.isSelected ? "var(--color-on-accent)" : "var(--color-text)",
    cursor: "pointer",
    "&:active": {
      backgroundColor: "var(--color-accent)",
      color: "var(--color-on-accent)",
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
    boxShadow: "var(--shadow-md)",
    zIndex: 1000,
  }),
  menuList: (base) => ({
    ...base,
    padding: "0.25rem",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    "&:hover": {
      color: "var(--color-accent)",
    },
  }),
};

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = "— Выберите —",
  isMulti = false,
  isDisabled = false,
  isRequired = false,
}: SelectProps) {
  // Преобразуем строковые значения в объекты SelectOption для react-select
  const selectValue = React.useMemo(() => {
    if (isMulti) {
      if (!value || !Array.isArray(value) || value.length === 0) {
        return [];
      }
      return options.filter((opt) => value.includes(opt.value));
    } else {
      if (!value || typeof value !== "string" || value === "") {
        return null;
      }
      return options.find((opt) => opt.value === value) || null;
    }
  }, [value, options, isMulti]);

  if (isMulti) {
    return (
      <Select<SelectOption, true>
        value={selectValue as readonly SelectOption[]}
        onChange={(selected) => {
          const values = selected ? selected.map((s) => s.value) : [];
          onChange(values);
        }}
        options={options}
        placeholder={placeholder}
        isMulti={true}
        isDisabled={isDisabled}
        isClearable={!isRequired}
        classNamePrefix="react-select"
        styles={customStyles}
        theme={(theme) => ({
          ...theme,
          borderRadius: 6,
          colors: {
            ...theme.colors,
            primary: "#2563eb",
            primary75: "#eff6ff",
            primary50: "#eff6ff",
            primary25: "#eff6ff",
          },
        })}
      />
    );
  }

  return (
    <Select<SelectOption, false>
      value={selectValue as SingleValue<SelectOption>}
      onChange={(selected) => {
        onChange(selected ? selected.value : "");
      }}
      options={options}
      placeholder={placeholder}
      isMulti={false}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isClearable={!isRequired}
      classNamePrefix="react-select"
      styles={customStyles}
      theme={(theme) => ({
        ...theme,
        borderRadius: 6,
        colors: {
          ...theme.colors,
          primary: "#2563eb",
          primary75: "#eff6ff",
          primary50: "#eff6ff",
          primary25: "#eff6ff",
        },
      })}
    />
  );
}

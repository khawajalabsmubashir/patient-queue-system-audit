import * as React from "react";
import { CalendarDays, Check, ChevronDown, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const emptyOption = "__queuecare_empty_option__";
const fieldClass =
  "h-11 rounded-lg border border-input bg-card px-3.5 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50 sm:text-sm";

function optionsFrom(
  children: React.ReactNode,
): React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return [];
    if (child.type === React.Fragment) return optionsFrom(child.props.children);
    return child.type === "option"
      ? [child as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>]
      : [];
  });
}
function textOf(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) =>
      React.isValidElement<{ children?: React.ReactNode }>(child)
        ? textOf(child.props.children)
        : String(child),
    )
    .join("");
}

/** Native backing field preserves FormData, required validation and change handlers.
 * Uses a non-modal Popover listbox (no RemoveScroll body lock or horizontal layout shift). */
export function SelectField({
  children,
  className,
  value,
  defaultValue,
  onChange,
  id,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options = optionsFrom(children);
  const optionValue = (option: (typeof options)[number]) =>
    String(option.props.value ?? textOf(option.props.children));
  const initial = String(defaultValue ?? (options[0] ? optionValue(options[0]) : ""));
  const [local, setLocal] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [dialogContainer, setDialogContainer] = React.useState<HTMLElement | null>(null);
  const selected = String(value ?? local);
  const backing = React.useRef<HTMLSelectElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const form = backing.current?.form;
    const reset = () => setLocal(initial);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial]);

  React.useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const dialog = trigger.current.closest<HTMLElement>("[role='dialog']");
    setDialogContainer(dialog);
  }, [open]);

  const activeOption = options.find((option) => optionValue(option) === selected) ?? options[0];
  const displayLabel = activeOption ? textOf(activeOption.props.children) : "";

  const commit = (nextValue: string) => {
    setOpen(false);
    if (backing.current) {
      backing.current.value = nextValue;
      backing.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    trigger.current?.focus();
  };

  return (
    <>
      <Popover open={open} onOpenChange={(next) => !props.disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <button
            ref={trigger}
            type="button"
            role="combobox"
            id={id}
            disabled={!!props.disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={props["aria-label"]}
            aria-labelledby={props["aria-labelledby"]}
            aria-describedby={props["aria-describedby"]}
            aria-invalid={props["aria-invalid"]}
            aria-required={props.required}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!props.disabled) setOpen(true);
              }
            }}
            className={cn(
              fieldClass,
              "inline-flex w-auto max-w-full min-w-0 cursor-pointer items-center justify-between gap-2.5 text-start whitespace-nowrap",
              className?.replace(/\bblock\b/g, "flex"),
            )}
          >
            <span className="min-w-0 truncate">{displayLabel}</span>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground opacity-70"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          container={dialogContainer}
          {...(dialogContainer ? { collisionBoundary: dialogContainer } : {})}
          collisionPadding={10}
          className="thin-scrollbar max-h-64 w-auto min-w-[max(var(--radix-popover-trigger-width),10rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div
            role="listbox"
            aria-label={props["aria-label"] ?? "Options"}
            className="flex flex-col gap-0.5"
          >
            {options.map((option) => {
              const val = optionValue(option);
              const isSelected = val === selected;
              return (
                <button
                  key={val || emptyOption}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!!option.props.disabled}
                  onClick={() => commit(val)}
                  className={cn(
                    "relative flex min-h-9 w-full cursor-pointer select-none items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm transition outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "bg-primary/10 font-medium text-primary",
                  )}
                >
                  <span className="truncate">{option.props.children}</span>
                  {isSelected && (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <select
        {...props}
        ref={backing}
        value={selected}
        aria-label={undefined}
        aria-labelledby={undefined}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onInvalid={() => trigger.current?.focus()}
        onChange={(event) => {
          setLocal(event.target.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
    </>
  );
}

/** Keep ISO local date/time strings and browser constraints; replace only picker UI. */
export function TemporalInput({
  type = "date",
  value,
  defaultValue,
  className,
  onChange,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const initial = String(defaultValue ?? "");
  const [local, setLocal] = React.useState(initial);
  const current = String(value ?? local);
  const [open, setOpen] = React.useState(false);
  const [dialogContainer, setDialogContainer] = React.useState<HTMLElement | null>(null);
  const [scrollContainer, setScrollContainer] = React.useState<HTMLElement | null>(null);
  const wrapper = React.useRef<HTMLDivElement>(null);
  const backing = React.useRef<HTMLInputElement>(null);
  const input = React.useRef<HTMLInputElement>(null);

  React.useLayoutEffect(() => {
    const dialogEl = (wrapper.current?.closest('[role="dialog"]') as HTMLElement | null) ?? null;
    const scrollEl =
      (wrapper.current?.closest('[data-dialog-body="true"]') as HTMLElement | null) ?? null;
    setDialogContainer(dialogEl);
    setScrollContainer(scrollEl);
  }, [open]);

  React.useEffect(() => {
    if (!open || !scrollContainer) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const anchorRect = wrapper.current?.getBoundingClientRect();
        const scrollerRect = scrollContainer.getBoundingClientRect();
        if (
          anchorRect &&
          scrollerRect.height > 0 &&
          (anchorRect.bottom < scrollerRect.top || anchorRect.top > scrollerRect.bottom)
        ) {
          setOpen(false);
          return;
        }
        window.dispatchEvent(new Event("resize"));
      });
    };
    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scrollContainer.removeEventListener("scroll", onScroll);
    };
  }, [open, scrollContainer]);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const datePart = type === "time" ? "" : current.split("T")[0];
  const timePart = type === "time" ? current : (current.split("T")[1] ?? "");
  const parsedDate = datePart ? new Date(datePart + "T00:00:00") : undefined;
  const selectedDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;
  const placeholder =
    type === "date" ? "YYYY-MM-DD" : type === "time" ? "HH:mm" : "YYYY-MM-DDTHH:mm";
  const commit = (next: string) => {
    setLocal(next);
    if (backing.current) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(backing.current, next);
      backing.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
  React.useEffect(() => {
    const native = backing.current;
    if (native)
      native.setCustomValidity(
        current && native.value !== current
          ? `Enter a valid ${type === "date" ? "date" : "time and date"} (${placeholder}).`
          : "",
      );
  }, [current, type, placeholder]);
  React.useEffect(() => {
    const form = backing.current?.form;
    const reset = () => setLocal(initial);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial]);
  const timeControls = (
    <div className="flex items-end gap-2 p-3">
      <label className="min-w-0 flex-1 text-sm">
        Hour
        <SelectField
          aria-label="Hour"
          className="mt-1 w-full"
          value={timePart.split(":")[0] || "00"}
          onChange={(e) => changeTime(e.target.value, timePart.split(":")[1] || "00")}
        >
          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((hour) => (
            <option key={hour}>{hour}</option>
          ))}
        </SelectField>
      </label>
      <label className="min-w-0 flex-1 text-sm">
        Minute
        <SelectField
          aria-label="Minute"
          className="mt-1 w-full"
          value={timePart.split(":")[1] || "00"}
          onChange={(e) => changeTime(timePart.split(":")[0] || "00", e.target.value)}
        >
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((minute) => (
            <option key={minute}>{minute}</option>
          ))}
        </SelectField>
      </label>
    </div>
  );
  function changeTime(hour: string, minute: string) {
    commit(
      type === "time"
        ? `${hour}:${minute}`
        : `${datePart || localDate(new Date())}T${hour}:${minute}`,
    );
  }
  return (
    <div ref={wrapper} className="relative min-w-0">
      <input
        {...props}
        id={inputId}
        ref={input}
        type="text"
        name={undefined}
        required={false}
        aria-required={props.required}
        min={undefined}
        max={undefined}
        step={undefined}
        value={current}
        placeholder={props.placeholder ?? placeholder}
        className={cn(fieldClass, "w-full pe-11", className)}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange?.(e);
        }}
        onBlur={props.onBlur}
      />
      <input
        {...props}
        id={undefined}
        aria-label={undefined}
        aria-labelledby={undefined}
        aria-describedby={undefined}
        ref={backing}
        type={type}
        value={current}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onInvalid={() => input.current?.focus()}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange?.(e);
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={props.disabled || props.readOnly}
            aria-label={`Choose ${type === "time" ? "time" : type === "date" ? "date" : "date and time"}`}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {type === "time" ? <Clock className="size-4" /> : <CalendarDays className="size-4" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          container={dialogContainer}
          {...(dialogContainer ? { collisionBoundary: dialogContainer } : {})}
          collisionPadding={10}
          sticky="always"
          className="w-auto max-w-[calc(100vw-3rem)] max-h-[calc(80dvh-2rem)] overflow-y-auto rounded-lg bg-card p-0 shadow-lg"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            input.current?.focus();
          }}
        >
          {type !== "time" && (
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate ?? new Date()}
              captionLayout="dropdown"
              startMonth={
                props.min
                  ? new Date(String(props.min).slice(0, 10) + "T00:00:00")
                  : new Date(1900, 0)
              }
              endMonth={
                props.max
                  ? new Date(String(props.max).slice(0, 10) + "T00:00:00")
                  : new Date(new Date().getFullYear() + 20, 11)
              }
              autoFocus
              disabled={(day) => {
                const iso = localDate(day);
                return !!(
                  (props.min && iso < String(props.min).slice(0, 10)) ||
                  (props.max && iso > String(props.max).slice(0, 10))
                );
              }}
              components={{
                Dropdown: ({ options, value, onChange, "aria-label": label, disabled }) => (
                  <SelectField
                    aria-label={label}
                    value={String(value)}
                    disabled={disabled}
                    onChange={onChange}
                  >
                    {options?.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                ),
              }}
              onSelect={(day) => {
                if (!day) return;
                commit(
                  localDate(day) + (type === "datetime-local" ? "T" + (timePart || "00:00") : ""),
                );
                if (type === "date") setOpen(false);
              }}
            />
          )}
          {type !== "date" && timeControls}
          <div className="flex justify-between gap-3 border-t p-3">
            {!props.required && (
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  commit("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="ms-auto rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

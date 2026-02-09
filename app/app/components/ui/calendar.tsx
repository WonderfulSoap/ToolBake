import type { CSSProperties } from "react";
import { DayPicker, UI, useDayPicker, type MonthCaptionProps } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { cn } from "~/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const navButton = "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40";

export function Calendar({
  className,
  classNames,
  components,
  hideNavigation: _hideNavigation,
  modifiersClassNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      hideNavigation
      className={cn("rounded-md border bg-card p-3 text-card-foreground shadow-sm", className)}
      components={{ ...components, MonthCaption: CalendarMonthCaption }}
      classNames={{
        root           : "space-y-3",
        months         : "flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6",
        month          : "flex-1 space-y-3",
        month_caption  : "flex w-full flex-col gap-2",
        caption_label  : "text-sm font-medium text-center text-foreground",
        nav            : "hidden",
        button_previous: navButton,
        button_next    : navButton,
        chevron        : "h-4 w-4 fill-current",
        month_grid     : "w-full border-collapse text-sm",
        weekdays       : "text-muted-foreground",
        weekday        : "py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-center",
        weeks          : "w-full",
        week           : "",
        day            : "relative p-1 text-center align-middle",
        day_button:
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        footer: "pt-2 text-xs text-muted-foreground",
        ...classNames,
      }}
      modifiersClassNames={{
        selected    : "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        today       : "text-primary",
        outside     : "text-muted-foreground/60",
        disabled    : "text-muted-foreground/40",
        hidden      : "invisible",
        range_middle: "aria-selected:bg-primary/30 aria-selected:text-primary-foreground",
        ...modifiersClassNames,
      }}
      style={
        {
          "--rdp-accent-color"           : "var(--color-primary)",
          "--rdp-accent-background-color": "color-mix(in oklch, var(--color-primary) 20%, transparent)",
        } as CSSProperties
      }
      {...props}
    />
  );
}

function CalendarMonthCaption({
  calendarMonth,
  className,
  displayIndex,
  ...props
}: MonthCaptionProps) {
  const { components, formatters, labels, previousMonth, nextMonth, goToMonth, classNames, dayPickerProps } =
    useDayPicker();
  const totalMonths = dayPickerProps?.numberOfMonths ?? 1;
  const showPrev = displayIndex === 0;
  const showNext = displayIndex === totalMonths - 1;
  const captionLabel = formatters.formatCaption(calendarMonth.date);
  return (
    <div {...props} className={cn("flex w-full flex-col items-center", className)}>
      <div className="flex w-full items-center justify-between text-muted-foreground">
        <button
          type="button"
          className={cn(navButton, !showPrev && "invisible")}
          aria-hidden={showPrev ? undefined : true}
          aria-label={showPrev && previousMonth ? labels.labelPrevious(previousMonth) : undefined}
          disabled={!showPrev || !previousMonth}
          onClick={() => {
            if (showPrev && previousMonth) goToMonth(previousMonth);
          }}
        >
          <components.Chevron orientation="left" className="h-4 w-4 fill-current" />
        </button>
        <span className={classNames[UI.CaptionLabel]}>{captionLabel}</span>
        <button
          type="button"
          className={cn(navButton, !showNext && "invisible")}
          aria-hidden={showNext ? undefined : true}
          aria-label={showNext && nextMonth ? labels.labelNext(nextMonth) : undefined}
          disabled={!showNext || !nextMonth}
          onClick={() => {
            if (showNext && nextMonth) goToMonth(nextMonth);
          }}
        >
          <components.Chevron orientation="right" className="h-4 w-4 fill-current" />
        </button>
      </div>
    </div>
  );
}

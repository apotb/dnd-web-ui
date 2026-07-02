import {
  selectedChoiceDescription,
  type ChoiceOption,
} from "@/lib/character/feature-choices";

interface SelectedChoiceDescriptionProps {
  options: readonly ChoiceOption[];
  value: string | undefined;
  /** When set, shown instead of the option description (e.g. general feature rules). */
  fallbackDescription?: string;
  className?: string;
}

export function SelectedChoiceDescription({
  options,
  value,
  fallbackDescription,
  className = "text-sm text-muted-foreground whitespace-pre-wrap",
}: SelectedChoiceDescriptionProps) {
  if (!value) return null;
  const text = selectedChoiceDescription(options, value) ?? fallbackDescription;
  if (!text) return null;
  return <p className={className}>{text}</p>;
}

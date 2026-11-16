import { renderCardMarkup } from "../../lib/card-markup";
import { useCardImages } from "../../lib/use-card-images";

/** Display card markup and locally stored images in lists as well as study. */
export function CardFace({ value, className }: { value: string; className: string }) {
  const images = useCardImages(value);
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderCardMarkup(value, "", images) }}
    />
  );
}

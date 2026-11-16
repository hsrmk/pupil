import { useEffect, useState } from "react";
import { getStorage } from "./storage";

/** Resolve Pupil-owned image references for a card face without exposing paths. */
export function useCardImages(value: string): Readonly<Record<string, string>> {
  const [images, setImages] = useState<Record<string, string>>({});
  const ids = [...value.matchAll(/!\[[^\]\n]*\]\(pupil-image:([\w-]+)\)/g)]
    .map((match) => match[1])
    .join(",");

  useEffect(() => {
    let active = true;
    if (!ids) {
      setImages({});
      return () => {
        active = false;
      };
    }
    Promise.all(
      ids.split(",").map(async (id) => [id, await getStorage().loadCardImage(id)] as const),
    )
      .then((entries) => {
        if (active)
          setImages(
            Object.fromEntries(
              entries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
            ),
          );
      })
      .catch(() => {
        if (active) setImages({});
      });
    return () => {
      active = false;
    };
  }, [ids]);
  return images;
}

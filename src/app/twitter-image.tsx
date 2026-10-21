import { matchCvOpenGraphImage, openGraphAlt, openGraphContentType, openGraphSize } from "@/lib/brand/open-graph-card";

export const alt = openGraphAlt;
export const size = openGraphSize;
export const contentType = openGraphContentType;

export default function TwitterImage() {
  return matchCvOpenGraphImage();
}

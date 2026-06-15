export interface HexLayoutImage {
  width: number;
  height: number;
  href: string;
  transform?: string | null;
}

export interface HexLayoutHex {
  id: number;
  points: string;
}

export interface HexLayout {
  id: string;
  name: string;
  viewBox: [number, number, number, number];
  image: HexLayoutImage;
  hexes: HexLayoutHex[];
}

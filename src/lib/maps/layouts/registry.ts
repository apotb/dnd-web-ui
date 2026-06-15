export const BUILTIN_HEX_LAYOUTS = {
  chult: {
    id: "chult",
    name: "Chult",
    sourceUrl: "https://raw.githubusercontent.com/ucak/chult/master/index.html",
  },
} as const;

export type BuiltinHexLayoutId = keyof typeof BUILTIN_HEX_LAYOUTS;

export function isBuiltinHexLayoutId(id: string): id is BuiltinHexLayoutId {
  return id in BUILTIN_HEX_LAYOUTS;
}

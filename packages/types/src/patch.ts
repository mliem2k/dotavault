// One entry from OpenDota's /constants/patch. The array index doubles as
// the patch ID referenced by Match.patch — there is no separate id field.
export type PatchConstant = {
  name: string
  date: string
}

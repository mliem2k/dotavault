/// <reference types="vite/client" />
/* bun-types is referenced for the Eden Treaty client: importing the api
   package's App type pulls its Bun-flavored sources into this typecheck. */
/// <reference types="bun-types" />

declare module '*.css' {
  const content: Record<string, string>
  export default content
}

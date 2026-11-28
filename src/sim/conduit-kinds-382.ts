/** Both Core identities occupy the same independent electrical layer. The
 * hidden variety neither creates an edifice nor blocks the power network. */
export const isConduitKind=(kind:unknown):kind is 'power-conduit'|'hidden-conduit'=>kind==='power-conduit'||kind==='hidden-conduit';

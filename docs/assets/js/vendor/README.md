# Vendored scripts for /demo-en-vivo/

Served from this site on purpose: the demo page uses the microphone, so it loads no third-party script.

| File | Source | Licence |
|---|---|---|
| `elevenlabs-client-1.26.0.js` | npm `@elevenlabs/client@1.26.0` (sha512-2xEEVRnOUVQjILeWpBQxAaUm4o0fHPtfkGCFdtJa9/z1V4BASpBCF+8G6D7TkWdNLzR4EPZeq3e0m+7H6n6vrw==), bundled with its dependencies (`@elevenlabs/types`, `livekit-client@2.22.4`, Apache-2.0) | MIT |
| `libsamplerate.worklet-2.1.2.js` | npm `@alexanderolsen/libsamplerate-js@2.1.2` (`dist/libsamplerate.worklet.js`, unmodified) | MIT |

The SDK fetches the second file from a CDN when the browser has no `sampleRate` audio constraint
(Safari/iOS and Firefox). `demo-en-vivo.js` passes `libsampleratePath` so that never happens.

Rebuild of the bundle (in a scratch directory, not in this repo):

```
npm i --save-exact --ignore-scripts @elevenlabs/client@1.26.0 esbuild
echo 'export { Conversation } from "@elevenlabs/client";' > entry.js
npx esbuild entry.js --bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=none --outfile=elevenlabs-client-1.26.0.js
```

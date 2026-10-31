// Every licensed-translation provider the proxy knows about, in the order
// they appear in the app. A provider only offers translations when its API
// key is set (see .env.example).

import type { Provider } from '../types.ts'
import { apiBible } from './apiBible.ts'
import { esv } from './esv.ts'
import { nlt } from './nlt.ts'

export const PROVIDERS: Provider[] = [apiBible, esv, nlt]

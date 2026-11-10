// Loaded only when VERIFY_PILE_INDEX=1 (vitest.config.ts): every pile index
// answer inside a simulation step is compared with a scan and throws on an
// unmarked pile write (src/sim/pile-index.ts).
import {setPileIndexVerification} from '../src/sim/pile-index.ts';
setPileIndexVerification(true);

/** Where the fictional golden dataset lives (packages/extraction/golden). Kept apart from generate.ts so importing the path never pulls the generator into a bundle. */
import path from "node:path";

export const GOLDEN_DIR = path.resolve(__dirname, "../../golden");

#!/usr/bin/env node
import { parseCliArgs, USAGE } from "./args.js";
import { runCli } from "./cli.js";
import { describeTools } from "./terminal.js";
import { loadManifest } from "./core/manifest.js";
import { startGui } from "./server/server.js";
import { runWizard } from "./wizard.js";
const MIN_NODE_MAJOR = 18;
async function main() {
    if (Number(process.versions.node.split(".")[0]) < MIN_NODE_MAJOR) {
        console.error(`Node.js ${MIN_NODE_MAJOR} or newer is required (you have ${process.versions.node}).`);
        return 1;
    }
    let options;
    try {
        options = parseCliArgs(process.argv.slice(2));
    }
    catch (error) {
        console.error(`${error.message}\n\n${USAGE}`);
        return 2;
    }
    if (options.isHelp) {
        console.log(USAGE);
        return 0;
    }
    if (options.isListTools) {
        console.log(describeTools().join("\n"));
        return 0;
    }
    const manifest = loadManifest();
    if (options.target || options.isGlobal)
        return runCli(manifest, options);
    if (options.isTerminal || !canShowBrowser()) {
        if (!process.stdin.isTTY) {
            console.error(`No browser and no interactive terminal here, so use the flags instead (e.g. --target <path> --yes).\n\n${USAGE}`);
            return 2;
        }
        return runWizard(manifest, { input: process.stdin, output: process.stdout });
    }
    await startGui(manifest, { shouldOpenBrowser: options.shouldOpenBrowser });
    return 0;
}
/** False over SSH or on Linux without a display, where opening a browser can't work. */
function canShowBrowser() {
    if (process.env.SSH_CONNECTION || process.env.SSH_TTY)
        return false;
    if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)
        return false;
    return true;
}
main().then((code) => {
    process.exitCode = code;
}, (error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
});

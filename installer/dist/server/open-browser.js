import { execFile } from "node:child_process";
/** Opens `url` in the default browser. Arguments are passed as an array, never through a shell string. */
export function openBrowser(url, onError) {
    const [command, args] = process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
            ? // `start` is a cmd builtin. The URL only holds host, port and a hex token, so it has no cmd metacharacters.
                ["cmd", ["/c", "start", '""', url]]
            : ["xdg-open", [url]];
    // windowsVerbatimArguments keeps cmd from re-quoting the empty title argument; it is ignored elsewhere.
    execFile(command, args, { windowsVerbatimArguments: true }, (error) => {
        if (error)
            onError(error);
    });
}

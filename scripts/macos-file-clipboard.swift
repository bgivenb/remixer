import AppKit
import Foundation

let paths = Array(CommandLine.arguments.dropFirst())
guard !paths.isEmpty else {
    FileHandle.standardError.write(Data("No files were supplied to the clipboard.\n".utf8))
    exit(2)
}

let urls: [NSURL] = paths.map { path in
    URL(fileURLWithPath: path).standardizedFileURL as NSURL
}

let pasteboard = NSPasteboard.general
pasteboard.clearContents()
guard pasteboard.writeObjects(urls) else {
    FileHandle.standardError.write(Data("macOS refused the file clipboard data.\n".utf8))
    exit(1)
}

let ownedChangeCount = pasteboard.changeCount
print("READY")
fflush(stdout)

// NSPasteboard requests URL representations lazily. Stay alive as the owner so
// every URL remains available, then exit as soon as another app changes it.
while pasteboard.changeCount == ownedChangeCount {
    RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.5))
}

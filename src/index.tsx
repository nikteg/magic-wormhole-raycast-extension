import { Action, ActionPanel, Clipboard, Form, showToast, Toast } from "@raycast/api";
import { useLayoutEffect, useState } from "react";
import { spawn } from "node:child_process";
import { basename } from "node:path";
import Style = Toast.Style;

// TODO let user configure path to magic-wormhole

async function wormhole(files: string[]): Promise<{ code: string; promise: Promise<string> }> {
  const wormholePath = "/opt/homebrew/bin/wormhole";

  return new Promise((resolve) => {
    let resolveDone: (receiver: string) => void;
    const args: string[] = [];
    let receiver = "";

    args.push("send");
    args.push(...files);

    const process = spawn(wormholePath, args);

    process.stderr.on("data", (chunk) => {
      const str = chunk.toString();
      console.error({ str });

      if (str.startsWith("Wormhole code is: ")) {
        const code = str.split(" ").at(-1).trim();

        resolve({
          code,
          promise: new Promise((resolve) => {
            resolveDone = resolve;
          }),
        });
      }

      if (str.startsWith("Sending ")) {
        const match = str.match(/\(<-.+\)/);

        if (match) {
          receiver = match.at(-1);
          console.log({ receiver });
        }
      }

      if (str.startsWith("Confirmation received")) {
        resolveDone(receiver);
      }
    });
  });
}

async function getIsWormholeInstalled(): Promise<boolean> {
  return true;
}

export default function Command() {
  const [files, setFiles] = useState<string[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWormholeInstalled, setIsWormholeInstalled] = useState(false);

  const filename = files.length > 0 ? basename(files[0]) : null;

  async function handleSubmit() {
    console.log(files);
    const { code, promise } = await wormhole(files);
    setCode(code);
    const toast = await showToast({ title: "Sending file...", message: `Copied code "${code}" to Clipboard` });
    await Clipboard.copy(code);
    toast.style = Style.Animated;
    setIsLoading(true);
    const receiver = await promise;
    setIsLoading(false);
    toast.style = Style.Success;
    toast.title = `${filename} sent successfully`;
    toast.message = `${filename} has been sent successfully to ${receiver}`;
  }

  useLayoutEffect(() => {
    getIsWormholeInstalled().then(setIsWormholeInstalled);
  }, []);

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel title={`Actions for ${filename}`}>
          {filename && <Action.SubmitForm onSubmit={handleSubmit} title={`Send ${filename}`} />}
          {code && (
            <>
              <Action.CopyToClipboard content={code} title={"Copy Code to Clipboard"} />
              <Action.CopyToClipboard
                content={`wormhole receive ${code}`}
                title={`Copy Receive Command to Clipboard`}
              />
            </>
          )}
        </ActionPanel>
      }
    >
      {isWormholeInstalled ? (
        <>
          <Form.FilePicker
            id="files"
            canChooseDirectories
            canChooseFiles
            allowMultipleSelection={false}
            title={"File or Folder"}
            value={files}
            onChange={setFiles}
          />
        </>
      ) : (
        <>
          <Form.Description text="`magic-wormhole` needs to be installed" />
        </>
      )}
    </Form>
  );
}

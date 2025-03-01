import { paths, parseConfig, isTag } from "./util";
import { release, upload, GitHubReleaser } from "./github";
import { setFailed, setOutput } from "@actions/core";
import { GitHub } from "@actions/github";
import { env } from "process";

async function run() {
  try {
    const config = parseConfig(env);
    if (!isTag(config.github_ref)) {
      throw new Error(`⚠️ GitHub Releases requires a tag`);
    }
    GitHub.plugin(require("@octokit/plugin-throttling"));
    const gh = new GitHub(config.github_token, {
      onRateLimit: (retryAfter, options) => {
        console.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        );
        if (options.request.retryCount === 0) {
          // only retries once
          console.log(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onAbuseLimit: (retryAfter, options) => {
        // does not retry, only logs a warning
        console.warn(
          `Abuse detected for request ${options.method} ${options.url}`
        );
      }
    });
    let rel = await release(config, new GitHubReleaser(gh));
    if (config.input_files) {
      const files = paths(config.input_files);
      if (files.length == 0) {
        console.warn(`🤔 ${config.input_files} not include valid file.`);
      }
      files.forEach(async path => {
        await upload(gh, rel.upload_url, path);
      });
    }
    console.log(`🎉 Release ready at ${rel.html_url}`);
    setOutput("url", rel.html_url);
  } catch (error) {
    setFailed(error.message);
  }
}

run();

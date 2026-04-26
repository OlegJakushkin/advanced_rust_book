# GitHub Pages Build and Deployment Guide

This project exports to a plain static site in `out/`, which makes it a good fit for GitHub Pages.

---

## Table of Contents

- [Quick summary](#quick-summary)
- [Understand your Pages URL type](#understand-your-pages-url-type)
- [Build locally for GitHub Pages](#build-locally-for-github-pages)
- [Preview the static output locally](#preview-the-static-output-locally)
- [Deploy manually](#deploy-manually)
- [Deploy with GitHub Actions](#deploy-with-github-actions)
- [GitHub Pages settings](#github-pages-settings)
- [Base path rules](#base-path-rules)
- [Custom domain note](#custom-domain-note)
- [Troubleshooting](#troubleshooting)

---

## Quick summary

For this repository:

- `npm run build` creates a static site in `out/`
- `docker compose up --build` also creates the static site in local `out/`
- GitHub Pages builds should use environment variables when the site is hosted under a repository subpath

---

## Understand your Pages URL type

There are two common GitHub Pages layouts.

### 1. User / organization site
URL shape:

```text
https://YOUR_NAME.github.io/
```

For this case, the site is served at the root and usually does **not** need a repository base path.

### 2. Project site
URL shape:

```text
https://YOUR_NAME.github.io/YOUR_REPO_NAME/
```

For this case, the site **does** need a base path so assets and routes resolve correctly.

This repo supports that with:

- `GITHUB_PAGES=true`
- `PAGES_BASE_PATH=YOUR_REPO_NAME`  
  or  
- `PAGES_BASE_PATH=/YOUR_REPO_NAME`

Both forms are accepted by the config.

---

## Build locally for GitHub Pages

Install dependencies:

```bash
npm install
```

### User / organization site build

```bash
GITHUB_PAGES=true npm run build
```

### Project site build

```bash
GITHUB_PAGES=true PAGES_BASE_PATH=YOUR_REPO_NAME npm run build
```

After the build, the Pages-ready output will be in:

```bash
out/
```

---

## Preview the static output locally

After building, you can preview the exported site with any static file server.

Example with Node:

```bash
npx serve@latest out
```

Example with Python:

```bash
python3 -m http.server 3000 --directory out
```

If you built with a project base path, make sure you test URLs that include that prefix.

---

## Deploy manually

If you want to deploy without GitHub Actions, you can publish the contents of `out/` yourself.

Typical flow:

1. Build the site
2. Copy the contents of `out/`
3. Publish them to the branch you use for Pages, commonly `gh-pages`

Example build for a project site:

```bash
GITHUB_PAGES=true PAGES_BASE_PATH=YOUR_REPO_NAME npm run build
```

Then publish the generated `out/` contents to your Pages branch root.

---

## Deploy with GitHub Actions

If you want GitHub to deploy the site automatically on every push, add a workflow.

Create:

```text
.github/workflows/deploy-pages.yml
```

Use this example:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build static export for GitHub Pages
        env:
          GITHUB_PAGES: "true"
          PAGES_BASE_PATH: "/${{ github.event.repository.name }}"
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

  deploy:
    needs: build
    runs-on: ubuntu-latest

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    permissions:
      pages: write
      id-token: write

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### If this is a user / organization site

Change the build step to:

```yaml
      - name: Build static export for GitHub Pages
        env:
          GITHUB_PAGES: "true"
          PAGES_BASE_PATH: ""
        run: npm run build
```

---

## GitHub Pages settings

In your GitHub repository:

1. Open **Settings**
2. Open **Pages**
3. Under **Build and deployment**
4. Set **Source** to **GitHub Actions**

If you are deploying manually to a branch instead, choose the branch-based Pages mode that matches your setup.

---

## Base path rules

This repo supports a GitHub Pages base path through environment variables.

### For root-hosted Pages

Use:

```bash
GITHUB_PAGES=true
```

### For project Pages

Use:

```bash
GITHUB_PAGES=true
PAGES_BASE_PATH=YOUR_REPO_NAME
```

or:

```bash
GITHUB_PAGES=true
PAGES_BASE_PATH=/YOUR_REPO_NAME
```

### Why this matters

Without the correct base path on a project site, you usually get:

- missing CSS,
- missing JS,
- broken icons,
- or a blank-looking page caused by asset 404s.

---

## Custom domain note

If you later attach a custom domain to GitHub Pages, you will usually want the site to behave like a root-hosted site.

That generally means:

- using your custom domain in Pages settings,
- optionally adding a `public/CNAME` file,
- and building without a repository subpath base path unless your domain intentionally includes one.

---

## Troubleshooting

### The site loads but styles or scripts are missing
Most likely cause: wrong base path for a project Pages deployment.

Fix:

```bash
GITHUB_PAGES=true PAGES_BASE_PATH=YOUR_REPO_NAME npm run build
```

---

### The site works locally but breaks on GitHub Pages
Local root hosting can hide path issues.

Fix:
- rebuild with the correct `PAGES_BASE_PATH`
- redeploy the new `out/`

---

### I used `docker compose up --build` and want the same Pages behavior
Pass the same environment variables before running Compose:

```bash
GITHUB_PAGES=true PAGES_BASE_PATH=YOUR_REPO_NAME docker compose up --build
```

That will build the export and copy the result into your local `out/` folder.

---

### I changed the repo name
If this is a project site, rebuild with the new repo name:

```bash
GITHUB_PAGES=true PAGES_BASE_PATH=NEW_REPO_NAME npm run build
```

---

## Recommended workflow

For most repositories, the cleanest setup is:

1. keep the site statically exportable,
2. use GitHub Actions,
3. build with `GITHUB_PAGES=true`,
4. set `PAGES_BASE_PATH` to the repo name for project Pages,
5. and deploy `out/` automatically.

That keeps the publishing flow repeatable and predictable.

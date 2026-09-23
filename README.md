# ViDent Clinical Evaluation Platform (ViDent LongMem Eval)

Interactive web application for clinical experts and licensed dental practitioners to review, evaluate, and annotate the ViDent-LongMem-500 longitudinal dental QA benchmark.

## Features

- **5-Point Likert Clinical Rubric**: Evaluates model responses across 5 clinical dimensions (Dental Correctness, Evidence Grounding, Personalization, Clinical Restraint, and Clarity & Usefulness).
- **Interactive Multi-Session Case Viewer**: Seamless navigation across 500 longitudinal cases with user history and provenance inspection.
- **Client-Side Persistence & Export**: Local storage persistence with one-click JSONL export for offline resilience.
- **Static CI/CD Deployment**: Fully optimized for Next.js static export and zero-configuration hosting on GitHub Pages.

## Directory Structure

- `app/`: Next.js 15 application source.
  - `page.tsx`: Main evaluation and review interface.
  - `components/ClinicalLikertEvalView.tsx`: 5-point Likert evaluation component.
- `public/dataset/`: Frozen benchmark datasets and paired comparison cases.
- `annotations/`: Directory for expert annotation exports.
- `.github/workflows/deploy.yml`: Automated CI/CD pipeline for GitHub Pages deployment.

## Getting Started

### 1. Install Dependencies
Requires Node.js 18 or higher.

```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Navigate to `http://localhost:3000` in your browser.

### 3. Production Build & Static Export
```bash
npm run build
```

Static output will be exported to `./out` ready for deployment.
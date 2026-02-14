# ExcelProcessor Documentation

The `ExcelProcessor` library provides utilities to format and beautify Excel reports exported from MicoWorld.

## Features
- **Header Styling**: Applies a professional standard theme with high-contrast text to headers.
- **Auto-Width**: Automatically adjusts column widths to fit the content (with a max width cap).
- **Borders**: Adds thin borders to all cells for better readability.

## Usage

```typescript
import { ExcelProcessor } from './src/lib/ExcelProcessor.js';

const processor = new ExcelProcessor();

// Beautify and overwrite the existing file
await processor.beautify('path/to/file.xlsx');

// Or save to a new path
await processor.beautify('path/to/input.xlsx', 'path/to/output.xlsx');
```

## Integration with MicoClient
This library is designed to work immediately after downloading an export via `MicoClient`.

```typescript
// 1. Download
const savedPath = await mailClient.downloadAttachment(attachment, './exports');

// 2. Process
const processor = new ExcelProcessor();
await processor.beautify(savedPath);
```

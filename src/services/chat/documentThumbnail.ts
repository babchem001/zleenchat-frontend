export const generateDocumentThumbnail = async (mimeType?: string) => {
  switch (true) {
    case mimeType?.includes("pdf"):
      return require("@/assets/file-icons/pdf.png");
    case mimeType?.includes("word"):
      return require("@/assets/file-icons/docx.png");
    case mimeType?.includes("presentation"):
      return require("@/assets/file-icons/pptx.png");
    case mimeType?.includes("spreadsheet"):
      return require("@/assets/file-icons/xlsx.png");
    case mimeType?.includes("zip"):
      return require("@/assets/file-icons/zip.png");
    default:
      return require("@/assets/file-icons/file.png");
  }
};

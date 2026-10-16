import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import pdfIcon from "../../../assets/file-icons/pdf.png";
import docxIcon from "../../../assets/file-icons/docx.png";
import xlsxIcon from "../../../assets/file-icons/xlsx.png";
import pptxIcon from "../../../assets/file-icons/pptx.png";
import txtIcon from "../../../assets/file-icons/txt.png";
import zipIcon from "../../../assets/file-icons/zip.png";
import fileIcon from "../../../assets/file-icons/file.png";

type ProcessDocumentParams = {
  fileUri: string;
  fileName: string;
  mimeType: string;
};

export const processDocument = async ({
  fileUri,
  fileName,
  mimeType,
}: ProcessDocumentParams) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    // const iconThumbnail = await generateFileIconThumbnail(mimeType);

    // const thumbInfo = await FileSystem.getInfoAsync(iconThumbnail);

    return {
      thumbnailUri: null,
      thumbnailSize: null,
      fileSize: fileInfo.exists && "size" in fileInfo ? fileInfo.size : null,
    };
  } catch (error) {
    console.log("Document processing error:", error);
    throw error;
  }
};

const generateFileIconThumbnail = async (mimeType: string): Promise<string> => {
  let sourceIcon: any;
  console.log("DOCUMENT MIME", mimeType);
  console.log("SOURCE ICON", sourceIcon);

  // ================= PDF =================

  if (mimeType === "application/pdf") {
    sourceIcon = pdfIcon;
  }

  // ================= DOCX =================
  else if (
    mimeType.includes("word") ||
    mimeType.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
  ) {
    sourceIcon = docxIcon;
  }

  // ================= XLSX =================
  else if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
  ) {
    sourceIcon = xlsxIcon;
  }

  // ================= PPTX =================
  else if (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
  ) {
    sourceIcon = pptxIcon;
  }

  // ================= TXT =================
  else if (mimeType.includes("text") || mimeType === "text/plain") {
    sourceIcon = txtIcon;
  }

  // ================= ZIP =================
  else if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z") ||
    mimeType.includes("compressed")
  ) {
    sourceIcon = zipIcon;
  }

  // ================= FALLBACK =================
  else {
    sourceIcon = fileIcon;
  }

  console.log("ABOUT TO MANIPULATE", typeof sourceIcon, sourceIcon);
  const asset = Asset.fromModule(sourceIcon);
  await asset.downloadAsync();
  return asset.localUri || asset.uri;
};

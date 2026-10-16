import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { FeedbackType } from "@/src/components/AppFeedbackModal";

type ShowFeedback = (
  type: FeedbackType,
  title: string,
  message: string,
) => void;

export const openDocuments = async (
  uri: string,
  showFeedback: ShowFeedback,
) => {
  try {
    const info = await FileSystem.getInfoAsync(uri);

    if (!info.exists) {
      showFeedback(
        "error",
        "Document Not Found",
        "The document could not be found. Please try again.",
      );
      return;
    }

    const available = await Sharing.isAvailableAsync();

    if (!available) {
      showFeedback(
        "warning",
        "Unavailable",
        "Document sharing is not available on this device.",
      );
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Open PDF",
      UTI: "com.adobe.pdf",
    });
  } catch (error) {
    console.log("OPEN DOCUMENT ERROR", error);

    showFeedback(
      "error",
      "Unable to Open Document",
      "Something went wrong while trying to open this document. Please try again.",
    );
  }
};
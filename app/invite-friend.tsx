import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import CountryPicker, {
  Country,
  CountryCode,
} from "react-native-country-picker-modal";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";
import apiClient from "@/src/services/api/apiClient";

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
  buttonText?: string;
};

export default function InviteFriendsScreen() {
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
    buttonText: "OK",
  });

  const countryCode = selectedCountry?.cca2 as CountryCode | undefined;

  const callingCode = useMemo(() => {
    if (!selectedCountry?.callingCode?.length) {
      return "";
    }

    return selectedCountry.callingCode[0];
  }, [selectedCountry]);

  const getCountryFlag = (code: string) => {
    return code
      .toUpperCase()
      .split("")
      .map((character) =>
        String.fromCodePoint(127397 + character.charCodeAt(0)),
      )
      .join("");
  };

  const getCountryName = (country: Country): string => {
    if (typeof country.name === "string") {
      return country.name;
    }

    return country.name.common;
  };

  const showFeedback = ({
    type,
    title,
    message,
    buttonText = "OK",
  }: {
    type: FeedbackType;
    title: string;
    message: string;
    buttonText?: string;
  }) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
      buttonText,
    });
  };

  const closeFeedback = () => {
    setFeedback((previous) => ({
      ...previous,
      visible: false,
    }));
  };

  const handleCountrySelect = (country: Country) => {
    Keyboard.dismiss();

    setSelectedCountry(country);
    setPhoneNumber("");

    setCountryPickerVisible(false);
  };

  const handlePhoneChange = (value: string) => {
    let cleaned = value.replace(/[^\d+()\-\s]/g, "");

    if (cleaned.includes("+")) {
      cleaned =
        (cleaned.startsWith("+") ? "+" : "") + cleaned.replace(/\+/g, "");
    }

    setPhoneNumber(cleaned);
  };

  const normalizePhoneNumber = (value: string, selectedCallingCode: string) => {
    const raw = value.trim();

    if (!raw || !selectedCallingCode) {
      return "";
    }

    const digitsOnly = raw.replace(/\D/g, "");

    if (!digitsOnly) {
      return "";
    }

    if (digitsOnly.startsWith(selectedCallingCode)) {
      return `+${digitsOnly}`;
    }

    const nationalNumber = digitsOnly.replace(/^0+/, "");

    if (!nationalNumber) {
      return "";
    }

    return `+${selectedCallingCode}${nationalNumber}`;
  };

  const validatePhoneNumber = (
    normalizedNumber: string,
    selectedCallingCode: string,
  ) => {
    if (!selectedCountry) {
      return "Please select your friend's country.";
    }

    if (!phoneNumber.trim()) {
      return "Please enter your friend's phone number.";
    }

    if (!normalizedNumber) {
      return "Please enter a valid phone number.";
    }

    const digits = normalizedNumber.replace(/\D/g, "");

    if (digits.length < 7 || digits.length > 15) {
      return "Please enter a valid phone number.";
    }

    if (!normalizedNumber.startsWith(`+${selectedCallingCode}`)) {
      return `The phone number does not match ${getCountryName(
        selectedCountry,
      )}'s country code.`;
    }

    return null;
  };
  const getInvitationErrorState = (error: any) => {
    const errorMessage =
      typeof error === "string"
        ? error
        : error?.message ||
          error?.error ||
          error?.data?.message ||
          error?.data?.error ||
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "";

    const normalizedErrorMessage = errorMessage.trim().toLowerCase();

    // ================= STEP 5: ALREADY REGISTERED =================
    if (
      normalizedErrorMessage.includes(
        "an account with this phone number already exists",
      )
    ) {
      return {
        type: "warning" as FeedbackType,
        title: "Already Registered",
        message:
          "This phone number is already registered with a Zleenchat account. You do not need to send an invitation to this number.",
        buttonText: "OK",
      };
    }
    
    if (
      normalizedErrorMessage.includes(
        "an active invitation already exists for this phone number",
      )
    ) {
      return {
        type: "info" as FeedbackType,
        title: "Invitation Already Exists",
        message:
          "An active invitation already exists for this phone number. Your friend can continue using the existing invitation.",
        buttonText: "OK",
      };
    }

    // ================= STEP 5: OTHER FAILED REQUEST =================
    return {
      type: "error" as FeedbackType,
      title: "Invitation Not Sent",
      message:
        errorMessage || "We could not send the invitation. Please try again.",
      buttonText: "Try Again",
    };
  };

  const handleSendInvitation = async () => {
    Keyboard.dismiss();

    if (!selectedCountry) {
      showFeedback({
        type: "warning",
        title: "Country Required",
        message: "Please select your friend's country first.",
        buttonText: "Continue",
      });

      return;
    }

    if (!callingCode) {
      showFeedback({
        type: "warning",
        title: "Country Code Unavailable",
        message:
          "We could not determine the selected country's calling code. Please select the country again.",
        buttonText: "Continue",
      });

      return;
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber, callingCode);
    const validationError = validatePhoneNumber(normalizedNumber, callingCode);

    if (validationError) {
      showFeedback({
        type: "warning",
        title: "Invalid Phone Number",
        message: validationError,
        buttonText: "Continue",
      });

      return;
    }

    try {
      setSendingInvitation(true);
      const response = await apiClient.post("/invitations/reserve-invitation", {
        recipientPhone: normalizedNumber,
      });

      console.log("STEP 5 INVITATION RESERVATION SUCCESS:", response?.data);
      showFeedback({
        type: "success",
        title: "Invitation Sent",
        message:
          "Your invitation has been sent successfully. Your friend can now continue with the invitation process.",
        buttonText: "Done",
      });
    } catch (error: any) {
      console.log(
        "STEP 5 INVITATION RESERVATION ERROR:",
        error?.response?.data || error,
      );
      const invitationErrorState = getInvitationErrorState(error);
      showFeedback(invitationErrorState);
    } finally {
      setSendingInvitation(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={22} color="#0B1545" />
            </TouchableOpacity>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Invite Friends</Text>

              <Text style={styles.headerSubtitle}>
                Invite someone to join you on Zleenchat.
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIconContainer}>
              <Ionicons name="people-outline" size={34} color="#6D4AFF" />
            </View>

            <Text style={styles.heroTitle}>Bring your friends to Zleenchat</Text>

            <Text style={styles.heroDescription}>
              Invite friends to join your Zleenchat community and start connecting
              with you.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Friend&apos;s phone number</Text>

            <Text style={styles.sectionDescription}>
              Choose the country first, then enter the phone number.
            </Text>

            {/* COUNTRY */}

            <Text style={styles.label}>Country</Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.countrySelector}
              onPress={() => {
                Keyboard.dismiss();
                setCountryPickerVisible(true);
              }}
            >
              <View style={styles.countrySelectorLeft}>
                <View style={styles.countryIconContainer}>
                  {selectedCountry ? (
                    <Text style={styles.selectedCountryFlag}>
                      {getCountryFlag(selectedCountry.cca2)}
                    </Text>
                  ) : (
                    <Ionicons name="globe-outline" size={21} color="#6D4AFF" />
                  )}
                </View>

                <View style={styles.countryTextContainer}>
                  {selectedCountry ? (
                    <>
                      <Text style={styles.countryName}>
                        {getCountryName(selectedCountry)}
                      </Text>

                      <Text style={styles.countryCallingCode}>
                        +{callingCode}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.placeholderText}>
                      Select your country
                    </Text>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-down-outline" size={21} color="#69708A" />
            </TouchableOpacity>

            <CountryPicker
              countryCode={countryCode || "US"}
              visible={countryPickerVisible}
              withFilter
              withFlag
              withEmoji
              withCallingCode
              withCloseButton
              withFlagButton={false}
              withCountryNameButton={false}
              withCallingCodeButton={false}
              translation="common"
              onSelect={handleCountrySelect}
              onClose={() => setCountryPickerVisible(false)}
              renderFlagButton={() => null}
            />

            {/* PHONE */}

            <Text style={styles.labelSpacing}>Phone number</Text>

            <View
              style={[
                styles.phoneInputContainer,
                !selectedCountry && styles.disabledPhoneContainer,
              ]}
            >
              <View style={styles.callingCodeContainer}>
                {selectedCountry ? (
                  <>
                    <Text style={styles.selectedFlag}>
                      {getCountryFlag(selectedCountry.cca2)}
                    </Text>

                    <Text style={styles.callingCodeText}>+{callingCode}</Text>
                  </>
                ) : (
                  <Ionicons name="call-outline" size={21} color="#B7BECE" />
                )}
              </View>

              <View style={styles.phoneDivider} />

              <TextInput
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder={
                  selectedCountry
                    ? "Enter phone number"
                    : "Select country first"
                }
                placeholderTextColor="#A0A8BD"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                editable={Boolean(selectedCountry)}
                style={styles.phoneInput}
                returnKeyType="done"
                onSubmitEditing={handleSendInvitation}
              />
            </View>

            {/* NORMALIZED PHONE PREVIEW */}

            {selectedCountry && phoneNumber.trim() ? (
              <View style={styles.normalizedPreview}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#2EB875"
                />

                <Text style={styles.normalizedPreviewText}>
                  International format:{" "}
                  {normalizePhoneNumber(phoneNumber, callingCode)}
                </Text>
              </View>
            ) : null}

            {/* SEND INVITATION */}

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.sendButton,
                sendingInvitation && styles.sendButtonDisabled,
              ]}
              onPress={handleSendInvitation}
              disabled={sendingInvitation}
            >
              {sendingInvitation ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text style={styles.sendButtonText}>Send Invitation</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color="#6D4AFF"
            />

            <Text style={styles.infoText}>
              The country calling code is automatically selected from the
              country you choose. Your phone number is normalized into
              international format before it is sent to the invitation system.
            </Text>
          </View>
        </ScrollView>

        <AppFeedbackModal
          visible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          buttonText={feedback.buttonText}
          onClose={closeFeedback}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FC",
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 20,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,

    shadowColor: "#0B1545",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0B1545",
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 14,
    color: "#69708A",
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginBottom: 18,

    alignItems: "center",

    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 3,
  },

  heroIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#E9EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  heroTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
  },

  heroDescription: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#69708A",
    textAlign: "center",
    maxWidth: 330,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 3,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0B1545",
  },

  sectionDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: "#69708A",
    marginBottom: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B1545",
    marginBottom: 8,
  },

  countrySelector: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: "#E0E4EE",
    borderRadius: 16,
    paddingHorizontal: 14,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: "#FFFFFF",
  },

  countrySelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  countryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E9EEFF",

    alignItems: "center",
    justifyContent: "center",

    marginRight: 12,
  },

  selectedCountryFlag: {
    fontSize: 22,
  },

  countryTextContainer: {
    flex: 1,
  },

  countryName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1545",
  },

  countryCallingCode: {
    marginTop: 3,
    fontSize: 13,
    color: "#69708A",
  },

  placeholderText: {
    fontSize: 15,
    color: "#A0A8BD",
  },

  labelSpacing: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B1545",
    marginTop: 20,
    marginBottom: 8,
  },

  phoneInputContainer: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: "#E0E4EE",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 12,
  },

  disabledPhoneContainer: {
    backgroundColor: "#F5F6FA",
    borderColor: "#E6E9F0",
  },

  callingCodeContainer: {
    minWidth: 78,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedFlag: {
    fontSize: 22,
    marginRight: 6,
  },

  callingCodeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1545",
  },

  phoneDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E0E4EE",
    marginHorizontal: 8,
  },

  phoneInput: {
    flex: 1,
    minHeight: 60,
    fontSize: 16,
    color: "#0B1545",
  },

  normalizedPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },

  normalizedPreviewText: {
    flex: 1,
    marginLeft: 7,
    fontSize: 12,
    color: "#69708A",
  },

  sendButton: {
    minHeight: 56,
    borderRadius: 17,
    backgroundColor: "#6D4AFF",
    marginTop: 24,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,
  },

  sendButtonDisabled: {
    opacity: 0.7,
  },

  sendButtonText: {
    marginLeft: 9,
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EEF0FF",
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
  },

  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#4D5673",
  },
});

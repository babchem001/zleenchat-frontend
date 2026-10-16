import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Country, State, ICountry, IState } from "country-state-city";
import { getCalendars } from "expo-localization";

import {
  registerUser,
  requestInvitationCode,
  verifyInvitationCode,
  verifyPhoneInvitationCode,
} from "@/src/services/auth/authService";

type PickerType = "country" | "state" | null;

export default function RegisterScreen() {
  const [loading, setLoading] = useState(false);
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [invitationRequested, setInvitationRequested] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [hasInvitation, setHasInvitation] = useState<boolean | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneVerificationAttempts, setPhoneVerificationAttempts] = useState(0);
  const [phoneVerificationLocked, setPhoneVerificationLocked] = useState(false);
  const [smsCode, setSmsCode] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    invitationCode: "",
    phoneNumber: "",

    countryCode: "",
    country: "",
    state: "",
    city: "",
    timezone: "",
  });

  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: FeedbackType;
    title: string;
    message: string;
    buttonText?: string;
    onClose?: () => void;
  }>({
    visible: false,
    type: "info",
    title: "",
    message: "",
    buttonText: "OK",
  });

  const showFeedback = ({
    type,
    title,
    message,
    buttonText = "OK",
    onClose,
  }: {
    type: FeedbackType;
    title: string;
    message: string;
    buttonText?: string;
    onClose?: () => void;
  }) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
      buttonText,
      onClose,
    });
  };

  const closeFeedback = () => {
    const callback = feedback.onClose;

    setFeedback((previous) => ({
      ...previous,
      visible: false,
    }));

    if (callback) {
      callback();
    }
  };

  useEffect(() => {
    const calendars = getCalendars();
    const timezone = calendars?.[0]?.timeZone;

    if (timezone) {
      setForm((previous) => ({
        ...previous,
        timezone,
      }));
    }
  }, []);

  const update = (key: string, value: string) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    // Changing the phone number invalidates the previous phone verification.
    if (key === "phoneNumber" && phoneVerified) {
      setPhoneVerified(false);
      setSmsCode("");
      setInvitationRequested(false);
      setEmailVerified(false);
      setVerifiedEmail("");
      setForm((previous) => ({
        ...previous,
        invitationCode: "",
      }));
    }

    // If the user changes their email after verification, the previous verification becomes invalid.
    if (key === "email") {
      const normalizedValue = value.trim().toLowerCase();

      if (verifiedEmail && normalizedValue !== verifiedEmail) {
        setEmailVerified(false);
        setVerifiedEmail("");
        setInvitationRequested(false);

        setForm((previous) => ({
          ...previous,
          invitationCode: "",
        }));
      }
    }

    if (key === "invitationCode" && emailVerified) {
      setEmailVerified(false);
      setVerifiedEmail("");
    }
  };

  // Verify email
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(email.trim());
  };

  // Verify phone verification
  const handleVerifyPhoneInvitation = async () => {
    const normalizedPhone = form.phoneNumber.trim().replace(/[\s()-]/g, "");
    const normalizedSmsCode = smsCode.trim();

    if (!normalizedPhone) {
      showFeedback({
        type: "warning",
        title: "Phone Number Required",
        message:
          "Please enter the phone number that received the invitation code.",
        buttonText: "Continue",
      });

      return;
    }

    if (!/^\d{5}$/.test(normalizedSmsCode)) {
      showFeedback({
        type: "warning",
        title: "Invalid SMS Code",
        message: "Please enter the 5-digit SMS invitation code.",
        buttonText: "Continue",
      });

      return;
    }

    if (phoneVerificationLocked) {
      showFeedback({
        type: "warning",
        title: "Invited Registration Locked",
        message:
          "The maximum of three phone invitation verification attempts has been reached. You can continue registration as a normal user.",
        buttonText: "Continue",
      });

      return;
    }

    try {
      setVerifyingPhone(true);

      const response = await verifyPhoneInvitationCode(
        normalizedPhone,
        normalizedSmsCode,
      );

      setPhoneVerified(true);
      setPhoneVerificationLocked(false);
      setPhoneVerificationAttempts(3 - (response.attemptsRemaining ?? 3));

      setForm((previous) => ({
        ...previous,
        phoneNumber: normalizedPhone,
      }));

      showFeedback({
        type: "success",
        title: "Invitation Verified",
        message:
          "Your phone invitation has been verified successfully. You can now continue with your email and registration details.",
        buttonText: "Continue",
      });
    } catch (error: any) {
      const message =
        error?.message ||
        "The phone number and 5-digit SMS code could not be verified.";

      const maximumAttemptsReached = message.includes(
        "Maximum verification attempts reached",
      );

      if (maximumAttemptsReached) {
        setPhoneVerificationLocked(true);
        setPhoneVerified(false);
        setPhoneVerificationAttempts(3);
      } else {
        setPhoneVerificationAttempts((previous) => Math.min(3, previous + 1));
      }

      setPhoneVerified(false);

      showFeedback({
        type: "error",
        title: maximumAttemptsReached
          ? "Verification Locked"
          : "Verification Failed",
        message,
        buttonText: "Continue",
      });
    } finally {
      setVerifyingPhone(false);
    }
  };

  const handleRequestInvitationCode = async () => {
    const normalizedEmail = form.email.trim().toLowerCase();

    if (!normalizedEmail) {
      showFeedback({
        type: "warning",
        title: "Email Required",
        message: "Please enter your email address first.",
        buttonText: "Continue",
      });

      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      showFeedback({
        type: "warning",
        title: "Invalid Email",
        message: "Please enter a valid email address.",
        buttonText: "Continue",
      });

      return;
    }

    if (hasInvitation === true && !phoneVerified) {
      showFeedback({
        type: "warning",
        title: "Phone Invitation Verification Required",
        message:
          "Please verify the 5-digit SMS invitation code before requesting your email invitation code.",
        buttonText: "Continue",
      });

      return;
    }

    try {
      setSendingInvitation(true);

      await requestInvitationCode(
        normalizedEmail,
        hasInvitation === true ? form.phoneNumber.trim() : undefined,
      );

      setInvitationRequested(true);
      setEmailVerified(false);
      setVerifiedEmail("");

      setForm((previous) => ({
        ...previous,
        invitationCode: "",
      }));

      showFeedback({
        type: "success",
        title: "Invitation Code Sent",
        message: `An invitation code has been sent to ${normalizedEmail}. Please check your inbox and enter the code below.`,
        buttonText: "Continue",
      });
    } catch (error: any) {
      showFeedback({
        type: "error",
        title: "Unable to Send Code",
        message:
          error?.message ||
          "We were unable to send an invitation code to this email.",
        buttonText: "Try Again",
      });
    } finally {
      setSendingInvitation(false);
    }
  };

  // Verify email and code
  const handleVerifyEmail = async () => {
    const normalizedEmail = form.email.trim().toLowerCase();

    const invitationCode = form.invitationCode.trim().toUpperCase();

    if (!normalizedEmail) {
      showFeedback({
        type: "warning",
        title: "Email Required",
        message: "Please enter your email address.",
        buttonText: "Continue",
      });

      return;
    }

    if (!invitationCode) {
      showFeedback({
        type: "warning",
        title: "Invitation Code Required",
        message: "Please enter the invitation code sent to your email.",
        buttonText: "Continue",
      });

      return;
    }

    try {
      setVerifyingEmail(true);

      await verifyInvitationCode({
        email: normalizedEmail,
        invitationCode,
      });

      setEmailVerified(true);
      setVerifiedEmail(normalizedEmail);

      setForm((previous) => ({
        ...previous,
        invitationCode,
      }));

      showFeedback({
        type: "success",
        title: "Email Verified",
        message: "Your email address has been successfully verified.",
        buttonText: "Continue",
      });
    } catch (error: any) {
      setEmailVerified(false);
      setVerifiedEmail("");

      showFeedback({
        type: "error",
        title: "Verification Failed",
        message:
          error?.message || "The invitation code is invalid or has expired.",
        buttonText: "Try Again",
      });
    } finally {
      setVerifyingEmail(false);
    }
  };

  const countries = useMemo(() => {
    return Country.getAllCountries().sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, []);

  const states = useMemo(() => {
    if (!form.countryCode) {
      return [];
    }

    return State.getStatesOfCountry(form.countryCode).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [form.countryCode]);

  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return countries;
    }

    return countries.filter((country) =>
      country.name.toLowerCase().includes(query),
    );
  }, [countries, searchQuery]);

  const filteredStates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return states;
    }

    return states.filter((state) => state.name.toLowerCase().includes(query));
  }, [states, searchQuery]);

  // Flag emoji
  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode || countryCode.length !== 2) {
      return "🌍";
    }

    return countryCode
      .toUpperCase()
      .split("")
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join("");
  };

  const openPicker = (type: PickerType) => {
    Keyboard.dismiss();
    setSearchQuery("");
    setPickerType(type);
  };

  const closePicker = () => {
    setPickerType(null);
    setSearchQuery("");
  };

  const handleCountrySelect = (country: ICountry) => {
    setForm((previous) => ({
      ...previous,
      country: country.name,
      countryCode: country.isoCode,
      state: "",
      city: previous.city,
    }));

    closePicker();
  };

  const handleStateSelect = (state: IState) => {
    setForm((previous) => ({
      ...previous,
      state: state.name,
    }));

    closePicker();
  };

  // Register
  const handleRegister = async () => {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.username.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      showFeedback({
        type: "warning",
        title: "Missing Information",
        message:
          "Please complete all required fields before creating your account.",
        buttonText: "Continue",
      });

      return;
    }

    if (!emailVerified) {
      showFeedback({
        type: "warning",
        title: "Email Verification Required",
        message:
          "Please request your invitation code and verify your email before creating your account.",
        buttonText: "Continue",
      });

      return;
    }

    if (form.email.trim().toLowerCase() !== verifiedEmail) {
      showFeedback({
        type: "warning",
        title: "Email Verification Required",
        message:
          "The email address has changed. Please request and verify a new invitation code.",
        buttonText: "Continue",
      });

      return;
    }

    if (!form.invitationCode.trim()) {
      showFeedback({
        type: "warning",
        title: "Invitation Code Required",
        message: "Please enter and verify your invitation code.",
        buttonText: "Continue",
      });

      return;
    }

    if (hasInvitation === true && !phoneVerified) {
      showFeedback({
        type: "warning",
        title: "Phone Invitation Verification Required",
        message:
          "Please verify the 5-digit SMS invitation code before creating your account.",
        buttonText: "Continue",
      });

      return;
    }

    try {
      setLoading(true);

      await registerUser({
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        invitationCode: form.invitationCode.trim().toUpperCase(),
        phoneNumber:
          hasInvitation === true
            ? form.phoneNumber.trim()
            : form.phoneNumber.trim() || undefined,
        countryCode: form.countryCode || undefined,
        country: form.country || undefined,
        state: form.state.trim() || undefined,
        city: form.city.trim() || undefined,
        timezone: form.timezone || undefined,
      });

      showFeedback({
        type: "success",
        title: "Account Created!",
        message: "Your Zleenchat account has been successfully created.",
        buttonText: "Continue",
        onClose: () => {
          router.replace("/auth/login");
        },
      });
    } catch (error: any) {
      showFeedback({
        type: "error",
        title: "Registration Failed",
        message:
          error?.message || "Unable to create your account. Please try again.",
        buttonText: "Try Again",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPickerItem = ({ item }: { item: ICountry | IState }) => {
    const isCountryPicker = pickerType === "country";
    const countryItem = item as ICountry;
    const stateItem = item as IState;

    return (
      <TouchableOpacity
        style={styles.pickerItem}
        activeOpacity={0.75}
        onPress={() => {
          if (isCountryPicker) {
            handleCountrySelect(countryItem);
          } else {
            handleStateSelect(stateItem);
          }
        }}
      >
        <View style={styles.pickerItemLeft}>
          <View
            style={[
              styles.pickerItemIcon,
              !isCountryPicker && styles.statePickerItemIcon,
            ]}
          >
            {isCountryPicker ? (
              <Text style={styles.flag}>
                {getFlagEmoji(countryItem.isoCode)}
              </Text>
            ) : (
              <Ionicons name="map-outline" size={21} color="#6D4AFF" />
            )}
          </View>

          <Text style={styles.pickerItemText}>
            {isCountryPicker ? countryItem.name : stateItem.name}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={19} color="#A0A8BD" />
      </TouchableOpacity>
    );
  };

  const pickerData =
    pickerType === "country" ? filteredCountries : filteredStates;

  const pickerTitle =
    pickerType === "country"
      ? "Select your country"
      : "Select your state or province";

  const pickerSubtitle =
    pickerType === "country"
      ? "Choose the country where you live."
      : `Choose your state, province, or region${
          form.country ? ` in ${form.country}` : ""
        }.`;

  const searchPlaceholder =
    pickerType === "country"
      ? "Search countries"
      : "Search states or provinces";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>

            <Image
              source={require("@/assets/images/zalvro_icon_optimized.png")}
              style={styles.logo}
              contentFit="contain"
            />

            <Text style={styles.title}>Create your account</Text>

            <Text style={styles.subtitle}>
              Join Zleenchat and start connecting.
            </Text>

            <View style={styles.card}>
              <View style={styles.invitationChoiceContainer}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Ionicons
                      name="mail-unread-outline"
                      size={20}
                      color="#2563EB"
                    />
                  </View>

                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>
                      Do you have an Invitation?
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      Choose how you want to continue with registration.
                    </Text>
                  </View>
                </View>

                <View style={styles.invitationChoiceButtons}>
                  <TouchableOpacity
                    style={[
                      styles.invitationChoiceButton,
                      hasInvitation === false &&
                        styles.invitationChoiceButtonSelected,
                    ]}
                    onPress={() => {
                      // Normal registration path.
                      setHasInvitation(false);
                      setPhoneVerified(false);
                      setPhoneVerificationLocked(false);
                      setPhoneVerificationAttempts(0);
                      setSmsCode("");
                      setInvitationRequested(false);
                      setEmailVerified(false);
                      setVerifiedEmail("");

                      setForm((previous) => ({
                        ...previous,
                        phoneNumber: "",
                        invitationCode: "",
                      }));
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={21}
                      color={hasInvitation === false ? "#FFFFFF" : "#2563EB"}
                    />

                    <Text
                      style={[
                        styles.invitationChoiceButtonText,
                        hasInvitation === false &&
                          styles.invitationChoiceButtonTextSelected,
                      ]}
                    >
                      No
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.invitationChoiceButton,
                      hasInvitation === true &&
                        styles.invitationChoiceButtonSelected,
                    ]}
                    onPress={() => {
                      setHasInvitation(true);
                      setPhoneVerified(false);
                      setPhoneVerificationLocked(false);
                      setPhoneVerificationAttempts(0);
                      setSmsCode("");
                      setInvitationRequested(false);
                      setEmailVerified(false);
                      setVerifiedEmail("");

                      setForm((previous) => ({
                        ...previous,
                        invitationCode: "",
                      }));
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={21}
                      color={hasInvitation === true ? "#FFFFFF" : "#2563EB"}
                    />

                    <Text
                      style={[
                        styles.invitationChoiceButtonText,
                        hasInvitation === true &&
                          styles.invitationChoiceButtonTextSelected,
                      ]}
                    >
                      Yes
                    </Text>
                  </TouchableOpacity>
                </View>

                {hasInvitation === true && (
                  <View style={styles.phoneInvitationContainer}>
                    {!phoneVerified ? (
                      <>
                        <Text style={styles.phoneInvitationTitle}>
                          Verify your phone invitation
                        </Text>

                        <Text style={styles.phoneInvitationDescription}>
                          Enter the phone number that received the Zleenchat
                          invitation, then enter the 5-digit SMS code sent to
                          that number.
                        </Text>

                        <View style={styles.expirationNotice}>
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color="#6D4AFF"
                          />

                          <Text style={styles.expirationNoticeText}>
                            The 5-digit invitation code expires in 15 minutes.
                            You have a maximum of 3 verification attempts.
                          </Text>
                        </View>

                        <Text style={styles.label}>
                          Phone number that received the code
                        </Text>

                        <View style={styles.inputContainer}>
                          <Ionicons
                            name="call-outline"
                            size={22}
                            color="#2563EB"
                            style={styles.leftIcon}
                          />

                          <TextInput
                            value={form.phoneNumber}
                            onChangeText={(value) =>
                              update(
                                "phoneNumber",
                                value.replace(/[^\d+]/g, ""),
                              )
                            }
                            placeholder="Enter the phone number"
                            placeholderTextColor="#A0A8BD"
                            keyboardType="phone-pad"
                            autoCapitalize="none"
                            style={styles.textInput}
                            editable={!phoneVerificationLocked}
                          />
                        </View>

                        <Text style={styles.labelSpacing}>
                          Enter the 5-digit SMS Code
                        </Text>

                        <View style={styles.inputContainer}>
                          <Ionicons
                            name="key-outline"
                            size={22}
                            color="#6D4AFF"
                            style={styles.leftIcon}
                          />

                          <TextInput
                            value={smsCode}
                            onChangeText={(value) =>
                              setSmsCode(value.replace(/\D/g, "").slice(0, 5))
                            }
                            placeholder="Enter 5-digit code"
                            placeholderTextColor="#A0A8BD"
                            keyboardType="number-pad"
                            maxLength={5}
                            style={styles.textInput}
                            editable={!phoneVerificationLocked}
                          />
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.verifyPhoneButton,
                            (verifyingPhone || phoneVerificationLocked) &&
                              styles.verifyPhoneButtonDisabled,
                          ]}
                          onPress={handleVerifyPhoneInvitation}
                          disabled={
                            verifyingPhone ||
                            phoneVerificationLocked ||
                            !form.phoneNumber.trim() ||
                            smsCode.length !== 5
                          }
                          activeOpacity={0.85}
                        >
                          {verifyingPhone ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <>
                              <Ionicons
                                name="shield-checkmark-outline"
                                size={18}
                                color="#FFFFFF"
                              />

                              <Text style={styles.verifyPhoneButtonText}>
                                Verify Phone Invitation
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {phoneVerificationAttempts > 0 &&
                          !phoneVerificationLocked && (
                            <Text style={styles.attemptText}>
                              {3 - phoneVerificationAttempts} verification
                              attempt
                              {3 - phoneVerificationAttempts === 1
                                ? ""
                                : "s"}{" "}
                              remaining.
                            </Text>
                          )}

                        {phoneVerificationLocked && (
                          <Text style={styles.lockedText}>
                            Invited registration is locked after three
                            unsuccessful verification attempts. You may continue
                            as a normal user.
                          </Text>
                        )}
                      </>
                    ) : (
                      <View style={styles.verifiedBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="#16A34A"
                        />

                        <Text style={styles.verifiedBadgeText}>
                          Phone invitation verified
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Progressive registration gate.
                  Email verification is the next stage after the invitation
                  choice, and after phone verification for invited users.
                  The remaining registration fields are intentionally rendered
                  only after email verification succeeds. */}

              {(hasInvitation === false || phoneVerified) && (
                <View>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconContainer}>
                      <Ionicons name="mail-outline" size={20} color="#2563EB" />
                    </View>

                    <View style={styles.sectionHeaderText}>
                      <Text style={styles.sectionTitle}>
                        Email Verification
                      </Text>

                      <Text style={styles.sectionSubtitle}>
                        Verify your email using the 25-character Zleenchat
                        invitation code.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.label}>Email</Text>

                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="mail-outline"
                      size={22}
                      color="#2563EB"
                      style={styles.leftIcon}
                    />

                    <TextInput
                      value={form.email}
                      onChangeText={(value) => update("email", value)}
                      placeholder="Enter your email address"
                      placeholderTextColor="#A0A8BD"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      style={styles.textInput}
                      returnKeyType="next"
                      editable={!emailVerified}
                    />

                    {emailVerified && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#16A34A"
                      />
                    )}
                  </View>

                  {emailVerified ? (
                    <View style={styles.verifiedBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#16A34A"
                      />

                      <Text style={styles.verifiedBadgeText}>
                        Email verified
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.sendCodeButton,
                          sendingInvitation && styles.sendCodeButtonDisabled,
                        ]}
                        onPress={handleRequestInvitationCode}
                        disabled={
                          sendingInvitation ||
                          !form.email.trim() ||
                          (hasInvitation === true && !phoneVerified)
                        }
                        activeOpacity={0.8}
                      >
                        {sendingInvitation ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <>
                            <Ionicons
                              name="send-outline"
                              size={17}
                              color="#2563EB"
                            />

                            <Text style={styles.sendCodeButtonText}>
                              {invitationRequested
                                ? "Resend Invitation Code"
                                : "Send Invitation Code"}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {invitationRequested && (
                        <View style={styles.invitationVerificationContainer}>
                          <Text style={styles.invitationHelperText}>
                            Enter the 25-character invitation code sent to your
                            email address.
                          </Text>

                          <Text style={styles.invitationLabel}>
                            Invitation Code
                          </Text>

                          <View style={styles.inputContainer}>
                            <Ionicons
                              name="key-outline"
                              size={22}
                              color="#6D4AFF"
                              style={styles.leftIcon}
                            />

                            <TextInput
                              value={form.invitationCode}
                              onChangeText={(value) =>
                                update("invitationCode", value)
                              }
                              placeholder="Enter invitation code"
                              placeholderTextColor="#A0A8BD"
                              autoCapitalize="characters"
                              autoCorrect={false}
                              style={styles.textInput}
                              returnKeyType="done"
                            />
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.verifyEmailButton,
                              verifyingEmail &&
                                styles.verifyEmailButtonDisabled,
                            ]}
                            onPress={handleVerifyEmail}
                            disabled={
                              verifyingEmail || !form.invitationCode.trim()
                            }
                            activeOpacity={0.85}
                          >
                            {verifyingEmail ? (
                              <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                              <>
                                <Ionicons
                                  name="shield-checkmark-outline"
                                  size={18}
                                  color="#FFFFFF"
                                />

                                <Text style={styles.verifyEmailButtonText}>
                                  Verify Email
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* The remainder of the registration form is locked
                  until the email + 25-character invitation code have been
                  successfully verified. This enforces:
                  YES -> Phone/SMS -> Email/Invitation Code -> Registration
                  NO  -> Email/Invitation Code -> Registration. */}

              {emailVerified && (
                <View>
                  <View style={styles.sectionDivider} />

                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconContainer}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#2563EB"
                      />
                    </View>

                    <View style={styles.sectionHeaderText}>
                      <Text style={styles.sectionTitle}>
                        Personal Information
                      </Text>

                      <Text style={styles.sectionSubtitle}>
                        Tell us a little about yourself.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.label}>First Name</Text>

                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="person-outline"
                      size={22}
                      color="#2563EB"
                      style={styles.leftIcon}
                    />

                    <TextInput
                      value={form.firstName}
                      onChangeText={(value) => update("firstName", value)}
                      placeholder="Enter your first name"
                      placeholderTextColor="#A0A8BD"
                      style={styles.textInput}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                  <Text style={styles.labelSpacing}>Last Name</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="person-outline"
                      size={22}
                      color="#2563EB"
                      style={styles.leftIcon}
                    />

                    <TextInput
                      value={form.lastName}
                      onChangeText={(value) => update("lastName", value)}
                      placeholder="Enter your last name"
                      placeholderTextColor="#A0A8BD"
                      style={styles.textInput}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.sectionDivider} />

                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconContainer}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color="#2563EB"
                      />
                    </View>

                    <View style={styles.sectionHeaderText}>
                      <Text style={styles.sectionTitle}>
                        Account Information
                      </Text>

                      <Text style={styles.sectionSubtitle}>
                        Choose how you&apos;ll appear on Zleenchat.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.label}>Username</Text>

                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="at-outline"
                      size={22}
                      color="#2563EB"
                      style={styles.leftIcon}
                    />

                    <TextInput
                      value={form.username}
                      onChangeText={(value) => update("username", value)}
                      placeholder="Choose a username"
                      placeholderTextColor="#A0A8BD"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.textInput}
                      returnKeyType="next"
                    />
                  </View>

                  <Text style={styles.labelSpacing}>Password</Text>

                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={22}
                      color="#6D4AFF"
                      style={styles.leftIcon}
                    />

                    <TextInput
                      value={form.password}
                      onChangeText={(value) => update("password", value)}
                      placeholder="Create a password"
                      placeholderTextColor="#A0A8BD"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.textInput}
                      returnKeyType="next"
                    />

                    <TouchableOpacity
                      onPress={() => setShowPassword((previous) => !previous)}
                      hitSlop={10}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={24}
                        color="#69708A"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sectionDivider} />

                  <View style={styles.sectionHeader}>
                    <View
                      style={[
                        styles.sectionIconContainer,
                        styles.locationIconContainer,
                      ]}
                    >
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color="#6D4AFF"
                      />
                    </View>

                    <View style={styles.sectionHeaderText}>
                      <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionTitle}>Location</Text>

                        <View style={styles.optionalBadge}>
                          <Text style={styles.optionalText}>Optional</Text>
                        </View>
                      </View>

                      <Text style={styles.sectionSubtitle}>
                        Help personalize your experience.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.label}>Country</Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.inputContainer}
                    onPress={() => openPicker("country")}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={22}
                      color="#6D4AFF"
                      style={styles.leftIcon}
                    />

                    <Text
                      style={
                        form.country
                          ? styles.selectValue
                          : styles.selectPlaceholder
                      }
                    >
                      {form.country || "Select your country"}
                    </Text>

                    <Ionicons
                      name="chevron-down-outline"
                      size={20}
                      color="#69708A"
                    />
                  </TouchableOpacity>

                  <Text style={styles.labelSpacing}>State / Province</Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={!form.countryCode}
                    style={[
                      styles.inputContainer,
                      !form.countryCode && styles.disabledInput,
                    ]}
                    onPress={() => openPicker("state")}
                  >
                    <Ionicons
                      name="map-outline"
                      size={22}
                      color={form.countryCode ? "#6D4AFF" : "#B7BECE"}
                      style={styles.leftIcon}
                    />

                    <Text
                      style={
                        form.state
                          ? styles.selectValue
                          : styles.selectPlaceholder
                      }
                    >
                      {form.state ||
                        (form.countryCode
                          ? states.length > 0
                            ? "Select your state or province"
                            : "No states or provinces available"
                          : "Select a country first")}
                    </Text>

                    <Ionicons
                      name="chevron-down-outline"
                      size={20}
                      color={form.countryCode ? "#69708A" : "#B7BECE"}
                    />
                  </TouchableOpacity>

                  <Text style={styles.labelSpacing}>City</Text>

                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="business-outline"
                      size={22}
                      color="#6D4AFF"
                      style={styles.leftIcon}
                    />

                    <TextInput
                      value={form.city}
                      onChangeText={(value) => update("city", value)}
                      placeholder="Enter your city"
                      placeholderTextColor="#A0A8BD"
                      style={styles.textInput}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.registerButton,
                      loading && styles.registerButtonDisabled,
                    ]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.registerButtonText}>
                        Create Account
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.registerContainer}
              onPress={() => router.replace("/auth/login")}
              activeOpacity={0.8}
            >
              <Text style={styles.registerText}>
                Already have an account?{" "}
                <Text style={styles.registerLink}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerType !== null}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closePicker} />

          <View style={styles.pickerModal}>
            <View style={styles.modalHandle} />

            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>{pickerTitle}</Text>
                <Text style={styles.pickerModalSubtitle}>{pickerSubtitle}</Text>
              </View>

              <TouchableOpacity
                style={styles.closePickerButton}
                onPress={closePicker}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color="#44506D" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={21}
                color="#7A849B"
                style={styles.searchIcon}
              />

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor="#9AA3B7"
                style={styles.searchInput}
                autoFocus
              />

              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#A0A8BD" />
                </TouchableOpacity>
              )}
            </View>

            {pickerData.length > 0 ? (
              <FlatList
                data={pickerData}
                keyExtractor={(item) => `${pickerType}-${item.name}`}
                renderItem={renderPickerItem}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pickerList}
              />
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="search-outline" size={28} color="#A0A8BD" />
                </View>
                <Text style={styles.emptyStateTitle}>Nothing found</Text>
                <Text style={styles.emptyStateText}>
                  Try searching for a different name.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <AppFeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText={feedback.buttonText}
        onClose={closeFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardContainer: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },

  topBlob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 140,
    backgroundColor: "#E9EEFF",
    top: -70,
    left: -120,
  },

  bottomBlob: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 130,
    backgroundColor: "#EEE8FF",
    bottom: -80,
    right: -110,
  },

  topGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(37,99,235,0.05)",
    top: 120,
    alignSelf: "center",
  },

  bottomGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(124,58,237,0.05)",
    bottom: 120,
    alignSelf: "center",
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },

  logo: {
    width: 104,
    height: 104,
    marginBottom: 18,
  },

  title: {
    fontSize: 38,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
    letterSpacing: -1,
  },

  subtitle: {
    marginTop: 10,
    marginBottom: 38,
    fontSize: 18,
    color: "#5E6785",
    textAlign: "center",
    lineHeight: 30,
    paddingHorizontal: 20,
  },

  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 34,
    paddingHorizontal: 24,
    paddingVertical: 26,
    shadowColor: "#1A4FFF",
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    elevation: 12,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },

  sectionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F2F5FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  locationIconContainer: {
    backgroundColor: "#F5F0FF",
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0B1545",
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#7A849B",
    lineHeight: 20,
  },

  sectionDivider: {
    height: 1,
    backgroundColor: "#EEF1F7",
    marginVertical: 32,
  },

  optionalBadge: {
    marginLeft: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#F2EDFF",
  },

  optionalText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D4AFF",
  },

  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#44506D",
    marginBottom: 9,
  },

  labelSpacing: {
    fontSize: 16,
    fontWeight: "700",
    color: "#44506D",
    marginTop: 22,
    marginBottom: 9,
  },

  inputContainer: {
    height: 62,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E7F2",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  disabledInput: {
    backgroundColor: "#F7F8FC",
    borderColor: "#EDF0F6",
    shadowOpacity: 0,
    elevation: 0,
  },

  leftIcon: {
    marginRight: 14,
  },

  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 0,
  },

  selectValue: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },

  selectPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: "#A0A8BD",
  },

  sendCodeButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#C9D8FF",
    backgroundColor: "#F4F7FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  sendCodeButtonDisabled: {
    opacity: 0.6,
  },

  sendCodeButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },

  invitationVerificationContainer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#E0E8FF",
  },

  invitationHelperText: {
    fontSize: 13,
    color: "#667085",
    lineHeight: 20,
    marginBottom: 18,
  },

  invitationLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#44506D",
    marginBottom: 9,
  },

  verifyEmailButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  verifyEmailButtonDisabled: {
    opacity: 0.6,
  },

  verifyEmailButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  verifiedBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  verifiedBadgeText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "800",
  },

  registerButton: {
    marginTop: 36,
    height: 55,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 10,
  },

  registerButtonDisabled: {
    opacity: 0.7,
  },

  registerButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },

  registerContainer: {
    marginTop: 34,
    marginBottom: 20,
  },

  registerText: {
    fontSize: 17,
    color: "#5F6884",
    textAlign: "center",
  },

  registerLink: {
    color: "#2563EB",
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,21,69,0.35)",
  },

  pickerModal: {
    height: "82%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    overflow: "hidden",
  },

  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 10,
    backgroundColor: "#D9DEEA",
    alignSelf: "center",
    marginBottom: 20,
  },

  pickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 20,
  },

  pickerModalTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0B1545",
  },

  pickerModalSubtitle: {
    marginTop: 5,
    fontSize: 14,
    color: "#7A849B",
    maxWidth: 280,
    lineHeight: 20,
  },

  closePickerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F4F6FB",
    justifyContent: "center",
    alignItems: "center",
  },

  searchContainer: {
    height: 56,
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 17,
    backgroundColor: "#F5F7FC",
    borderWidth: 1,
    borderColor: "#E5EAF3",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    height: "100%",
  },

  pickerList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  pickerItem: {
    minHeight: 66,
    borderRadius: 18,
    paddingHorizontal: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pickerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  pickerItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },

  statePickerItemIcon: {
    backgroundColor: "#F7F2FF",
  },

  flag: {
    fontSize: 25,
  },

  pickerItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#26324F",
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyStateIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#F4F6FB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#26324F",
  },

  emptyStateText: {
    marginTop: 7,
    textAlign: "center",
    fontSize: 14,
    color: "#7A849B",
    lineHeight: 20,
  },

  invitationChoiceContainer: {
    marginBottom: 30,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#E2E8FF",
  },

  invitationChoiceButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },

  invitationChoiceButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C9D8FF",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  invitationChoiceButtonSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  invitationChoiceButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563EB",
  },

  invitationChoiceButtonTextSelected: {
    color: "#FFFFFF",
  },

  phoneInvitationContainer: {
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E8FF",
  },

  phoneInvitationTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0B1545",
    marginBottom: 7,
  },

  phoneInvitationDescription: {
    fontSize: 13,
    color: "#667085",
    lineHeight: 20,
    marginBottom: 14,
  },

  expirationNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginBottom: 18,
    borderRadius: 14,
    backgroundColor: "#F5F1FF",
    borderWidth: 1,
    borderColor: "#E6DCFF",
  },

  expirationNoticeText: {
    flex: 1,
    marginLeft: 9,
    fontSize: 12,
    fontWeight: "600",
    color: "#5B43A8",
    lineHeight: 18,
  },

  verifyPhoneButton: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
  },

  verifyPhoneButtonDisabled: {
    opacity: 0.6,
  },

  verifyPhoneButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  attemptText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#6D4AFF",
  },

  lockedText: {
    marginTop: 12,
    paddingHorizontal: 4,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
    lineHeight: 18,
  },
});

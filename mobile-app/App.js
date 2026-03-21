import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  DEFAULT_API_BASE,
  LISTING_CATEGORIES,
  SUPPORT_PHONE,
  SUPPORT_WHATSAPP,
  SUPPORTED_COUNTRIES,
  buildPlotsUrl,
  formatPhoneForTel,
  formatPhoneForWhatsApp,
  inferApiBase,
  sortByPriority
} from "../shared/src/index.js";

const TOKEN_KEY = "plotconnect:userToken";
const PROFILE_KEY = "plotconnect:userProfile";
const ACCESS_FEE = 50;
const SUPPORT_EMAIL = "support@tst-plotconnect.com";
const SUPPORT_FACEBOOK = "https://web.facebook.com/profile.php?id=61586345377148";
const SUPPORT_INSTAGRAM = "https://www.instagram.com/techswifttrix/?hl=en";
const TERMS_PRIVACY_URL = "https://www.tst-plotconnect.com/privacy";
const ACCOUNT_DELETION_URL = "https://www.tst-plotconnect.com/account-deletion";
const SEARCH_RESULTS_PER_PAGE = 6;
const PROFILE_NOTIFICATIONS = [
  { title: "New listings available", body: "Fresh spaces matching your country were added today." },
  { title: "Account access update", body: "Activate your account to unblur images and unlock contacts." },
  { title: "Support is online", body: "Reach us by call, WhatsApp, email, Facebook, or Instagram." }
];
const DEFAULT_FILTERS = {
  country: "Kenya",
  county: "",
  area: "",
  category: "",
  minPrice: "",
  maxPrice: ""
};
const DISCOVER_CATEGORIES = [
  { label: "All", value: "" },
  { label: "Hostel", value: "Hostels" },
  { label: "Bedsitter", value: "Bedsitters" },
  { label: "Lodge", value: "Lodges" }
];
function useApiBase() {
  return useMemo(() => {
    const fromEnv = typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_URL : "";
    return inferApiBase(fromEnv || DEFAULT_API_BASE, { locationObject: null, storageObject: null });
  }, []);
}

function createAuthHeaders(token, includeJson = false) {
  const headers = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function formatStatusCountdown(status) {
  if (!status?.active || !status?.expiresAt) return "Inactive";
  const remainingMs = Math.max(0, new Date(status.expiresAt).getTime() - Date.now());
  const total = Math.floor(remainingMs / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m left`;
}

function getInitials(name) {
  return String(name || "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function mapCategoryLabel(category) {
  const value = String(category || "").toLowerCase();
  if (!value) return "Listing";
  if (value.includes("hostel")) return "Hostel";
  if (value.includes("bedsitter")) return "Bedsitter";
  if (value.includes("lodge")) return "Lodge";
  if (value.includes("apartment")) return "Apartment";
  return String(category);
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Price on request";
  return `Ksh ${numeric.toLocaleString()}`;
}

function getLocationLine(item) {
  return [item?.area, item?.county || item?.town, item?.country].filter(Boolean).join(", ");
}

function normalizeCountry(value) {
  return String(value || "").trim() || "Kenya";
}

function MiniChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.miniChip, active && styles.miniChipActive]}>
      <Text style={[styles.miniChipText, active && styles.miniChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TabButton({ label, icon, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.tabButton}>
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function FilterField({ label, value, placeholder, onChangeText, keyboardType = "default", half = false }) {
  return (
    <View style={[styles.filterField, half && styles.filterFieldHalf]}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TextInput
        style={styles.filterInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#627294"
        keyboardType={keyboardType}
      />
    </View>
  );
}

function SelectableInputField({
  label,
  value,
  placeholder,
  options,
  isOpen,
  onFocus,
  onBlur,
  onClose,
  onChangeText,
  onSelect,
  half = false
}) {
  const open = isOpen;
  const normalizedValue = String(value || "").trim().toLowerCase();
  const filteredOptions = options.filter((option) => String(option).toLowerCase().includes(normalizedValue));
  const dropdownOptions = [{ key: "__placeholder__", label: placeholder, value: "" }].concat(
    filteredOptions.map((option) => ({ key: option, label: option, value: option }))
  );
  return (
    <View style={[styles.filterField, half && styles.filterFieldHalf, isOpen && styles.filterFieldOpen]}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.dropdownTrigger}>
        <TextInput
          style={styles.dropdownInput}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#7c88a4"
        />
        <Text style={styles.dropdownChevron}>{open ? "˄" : "˅"}</Text>
      </View>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          <Pressable style={styles.dropdownModalCard} onPress={() => {}}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalLabel}>{label}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={styles.dropdownModalClose}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.dropdownModalInput}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#7c88a4"
              autoFocus
            />
            {filteredOptions.length > 0 ? (
              <FlatList
                data={dropdownOptions}
                keyExtractor={(item) => item.key}
                style={styles.dropdownScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.dropdownOption}
                    onPress={() => {
                      Keyboard.dismiss();
                      onSelect(item.value);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>{item.label}</Text>
                  </Pressable>
                )}
              />
            ) : (
              <View style={styles.dropdownOptionDisabled}>
                <Text style={styles.dropdownOptionDisabledText}>No options available</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ListingCard({ item, status, onPress }) {
  const locationLine = getLocationLine(item);
  const previewImage = Array.isArray(item?.images) && item.images.length ? item.images[0] : "";
  const mediaUnlocked = !!status?.active;
  return (
    <Pressable onPress={onPress} style={styles.listingCard}>
      <View style={styles.listingMediaRow}>
        {previewImage ? (
          <View style={styles.listingImageWrap}>
            <Image
              source={{ uri: previewImage }}
              style={styles.listingImage}
              blurRadius={mediaUnlocked ? 0 : 18}
            />
            {!mediaUnlocked ? <View style={styles.listingImageOverlay} /> : null}
            <View style={styles.priceBadgeFloating}>
              <Text style={styles.priceBadgeText}>{formatPrice(item?.price)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.listingMediaFallback}>
            <View style={styles.listingIllustration}>
              <Text style={styles.listingIllustrationText}>H</Text>
            </View>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{formatPrice(item?.price)}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.softBadge}>
          <Text style={styles.softBadgeText}>{mapCategoryLabel(item?.category)}</Text>
        </View>
        <View style={[styles.softBadge, styles.greenBadge]}>
          <Text style={[styles.softBadgeText, styles.greenBadgeText]}>Verified</Text>
        </View>
      </View>

      {!previewImage ? (
        <View style={styles.priceBadgeInline}>
          <Text style={styles.priceBadgeText}>{formatPrice(item?.price)}</Text>
        </View>
      ) : null}

      <Text style={styles.listingTitle}>{item?.title || "Untitled Listing"}</Text>
      <Text style={styles.listingLocation}>{locationLine || "Location not provided"}</Text>
      <Text style={styles.listingDescription} numberOfLines={2}>
        {item?.description || "No description added yet."}
      </Text>

      <View style={styles.listingFooterRow}>
        <Text style={styles.listingMetaText}>{item?.country || "Kenya"}</Text>
        <Text style={styles.ratingText}>4.6 (28)</Text>
      </View>

      <View style={styles.lockBanner}>
        <Text style={styles.lockBannerText}>
          {status?.active ? "Contacts available in details" : "Activate to view contacts"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function App() {
  const apiBase = useApiBase();
  const [token, setToken] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [activeScreen, setActiveScreen] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authFields, setAuthFields] = useState({
    registerName: "",
    registerCountry: DEFAULT_FILTERS.country,
    registerPhone: "",
    registerPassword: "",
    loginPhone: "",
    loginPassword: ""
  });
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [meta, setMeta] = useState({ countries: [], countiesByCountry: {}, areasByCounty: {} });
  const [plots, setPlots] = useState([]);
  const [loadingPlots, setLoadingPlots] = useState(false);
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [status, setStatus] = useState(null);
  const [paymentLog, setPaymentLog] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  const [searchPage, setSearchPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState("");
  const [showSupportCard, setShowSupportCard] = useState(false);
  const [showNotificationsCard, setShowNotificationsCard] = useState(false);
  const [showForgotOptions, setShowForgotOptions] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotStep, setForgotStep] = useState("request");
  const [forgotExpiresAt, setForgotExpiresAt] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const featuredPlots = plots.slice(0, 3);
  const totalSearchPages = Math.max(1, Math.ceil(plots.length / SEARCH_RESULTS_PER_PAGE));
  const paginatedPlots = plots.slice(
    (searchPage - 1) * SEARCH_RESULTS_PER_PAGE,
    searchPage * SEARCH_RESULTS_PER_PAGE
  );
  const counties = draftFilters.country ? meta.countiesByCountry?.[draftFilters.country] || [] : [];
  const areas = draftFilters.county ? meta.areasByCounty?.[draftFilters.county] || [] : [];

  useEffect(() => {
    (async () => {
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const savedProfile = await AsyncStorage.getItem(PROFILE_KEY);
      if (savedToken) {
        setToken(savedToken);
        setActiveScreen("home");
      }
      if (savedProfile) {
        try {
          const parsedProfile = JSON.parse(savedProfile);
          setUserProfile(parsedProfile);
          syncFiltersToCountry(parsedProfile?.country);
        } catch (_err) {
          setUserProfile(null);
        }
      }
    })();
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [apiBase]);

  useEffect(() => {
    loadPlots(appliedFilters);
  }, [apiBase, appliedFilters, token]);

  useEffect(() => {
    setSearchPage(1);
  }, [appliedFilters, token]);

  useEffect(() => {
    setSearchPage((prev) => Math.min(prev, Math.max(1, Math.ceil(plots.length / SEARCH_RESULTS_PER_PAGE))));
  }, [plots.length]);

  useEffect(() => {
    if (!token) {
      setStatus(null);
      setPaymentLog([]);
      return;
    }

    loadStatus();
    loadPayments();
    const timer = setInterval(() => {
      loadStatus();
    }, 15000);
    return () => clearInterval(timer);
  }, [token, apiBase]);

  useEffect(() => {
    if (!selectedPlotId) return;
    loadPlotDetail(selectedPlotId);
  }, [selectedPlotId, token, apiBase]);

  useEffect(() => {
    if (!message.text) return undefined;
    const timer = setTimeout(() => {
      setMessage({ text: "", error: false });
    }, 4000);
    return () => clearTimeout(timer);
  }, [message.text, message.error]);

  function showMessage(text, error = false) {
    setMessage({ text, error });
  }

  function syncFiltersToCountry(country) {
    const nextCountry = normalizeCountry(country);
    setDraftFilters((prev) => ({ ...prev, country: nextCountry, county: "", area: "" }));
    setAppliedFilters((prev) => ({ ...prev, country: nextCountry, county: "", area: "" }));
    setOpenDropdown("");
  }

  async function persistSession(nextToken, nextUser) {
    setToken(nextToken || "");
    setUserProfile(nextUser || null);
    if (nextUser) {
      syncFiltersToCountry(nextUser.country);
    } else {
      setDraftFilters(DEFAULT_FILTERS);
      setAppliedFilters(DEFAULT_FILTERS);
    }
    if (nextToken) {
      await AsyncStorage.setItem(TOKEN_KEY, nextToken);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextUser || null));
    } else {
      await AsyncStorage.multiRemove([TOKEN_KEY, PROFILE_KEY]);
    }
  }

  async function api(path, options = {}, authToken = token) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...createAuthHeaders(authToken, false),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function loadPlots(filters = appliedFilters) {
    setLoadingPlots(true);
    try {
      const response = await fetch(buildPlotsUrl(apiBase, filters), {
        headers: createAuthHeaders(token, false)
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.error || `Failed to load plots (${response.status})`);
      const rows = sortByPriority(Array.isArray(data) ? data : []);
      setPlots(rows);
      if (!selectedPlotId && rows[0]?.id) {
        setSelectedPlotId(rows[0].id);
      }
    } catch (err) {
      setPlots([]);
      showMessage(err.message || "Failed to load plots.", true);
    } finally {
      setLoadingPlots(false);
    }
  }

  async function loadMetadata() {
    try {
      const response = await fetch(`${apiBase}/api/metadata/locations`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Failed to load metadata (${response.status})`);
      setMeta({
        countries: Array.isArray(data.countries) ? data.countries : [],
        countiesByCountry: data.countiesByCountry && typeof data.countiesByCountry === "object" ? data.countiesByCountry : {},
        areasByCounty: data.areasByCounty && typeof data.areasByCounty === "object" ? data.areasByCounty : {}
      });
    } catch (_err) {
      setMeta({ countries: [], countiesByCountry: {}, areasByCounty: {} });
    }
  }

  async function loadPlotDetail(plotId) {
    if (!plotId) return;
    setLoadingDetail(true);
    try {
      const response = await fetch(`${apiBase}/api/plot/${encodeURIComponent(plotId)}`, {
        headers: createAuthHeaders(token, false)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Failed to load plot (${response.status})`);
      setSelectedPlot(data);
    } catch (err) {
      setSelectedPlot(null);
      showMessage(err.message || "Failed to load plot details.", true);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadStatus() {
    if (!token) return;
    try {
      const data = await api("/api/user/status");
      setStatus(data);
    } catch (err) {
      showMessage(err.message || "Failed to load access status.", true);
    }
  }

  async function loadPayments() {
    if (!token) return;
    setLoadingPayments(true);
    try {
      const data = await api("/api/user/payments");
      setPaymentLog(Array.isArray(data) ? data : []);
    } catch (err) {
      showMessage(err.message || "Failed to load payment history.", true);
    } finally {
      setLoadingPayments(false);
    }
  }

  async function handleRegister() {
    setAuthBusy(true);
    try {
      if (!authFields.registerName.trim()) throw new Error("Enter your full name.");
      if (!authFields.registerPhone.trim()) throw new Error("Enter your phone number.");
      if (!authFields.registerPassword.trim()) throw new Error("Create a password.");
      const data = await api(
        "/api/user/register",
        {
          method: "POST",
          headers: createAuthHeaders("", true),
          body: JSON.stringify({
            name: authFields.registerName.trim(),
            country: normalizeCountry(authFields.registerCountry),
            phone: authFields.registerPhone.trim(),
            password: authFields.registerPassword
          })
        },
        ""
      );
      await persistSession(data.token, data.user);
      setAuthFields((prev) => ({
        ...prev,
        registerPassword: "",
        registerCountry: normalizeCountry(data.user?.country)
      }));
      setActiveScreen("home");
      showMessage("Registration complete. Your account is ready.", false);
    } catch (err) {
      showMessage(err.message || "Registration failed.", true);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin() {
    setAuthBusy(true);
    try {
      if (!authFields.loginPhone.trim()) throw new Error("Enter your phone number.");
      if (!authFields.loginPassword.trim()) throw new Error("Enter your password.");
      const data = await api(
        "/api/user/login",
        {
          method: "POST",
          headers: createAuthHeaders("", true),
          body: JSON.stringify({
            phone: authFields.loginPhone.trim(),
            password: authFields.loginPassword
          })
        },
        ""
      );
      await persistSession(data.token, data.user);
      setAuthFields((prev) => ({ ...prev, loginPassword: "" }));
      setActiveScreen("home");
      showMessage("Login successful.", false);
    } catch (err) {
      showMessage(err.message || "Login failed.", true);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRequestPasswordResetCode() {
    setForgotBusy(true);
    try {
      const phone = (forgotPhone || authFields.loginPhone || "").trim();
      if (!phone) throw new Error("Enter your phone number first.");
      const data = await api(
        "/api/auth/request-code",
        {
          method: "POST",
          headers: createAuthHeaders("", true),
          body: JSON.stringify({ phone })
        },
        ""
      );
      setForgotPhone(phone);
      setForgotStep("verify");
      setForgotCode("");
      setForgotExpiresAt(data?.expiresAt || "");
      showMessage(data?.message || "OTP sent. Check your phone.", false);
    } catch (err) {
      showMessage(err.message || "Failed to send OTP.", true);
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleVerifyPasswordResetCode() {
    setForgotBusy(true);
    try {
      const phone = (forgotPhone || authFields.loginPhone || "").trim();
      if (!phone) throw new Error("Enter your phone number.");
      if (!forgotCode.trim()) throw new Error("Enter the OTP code.");
      if (!forgotNewPassword.trim()) throw new Error("Enter your new password.");
      const data = await api(
        "/api/auth/verify-code",
        {
          method: "POST",
          headers: createAuthHeaders("", true),
          body: JSON.stringify({
            phone,
            code: forgotCode.trim(),
            newPassword: forgotNewPassword
          })
        },
        ""
      );
      setAuthFields((prev) => ({ ...prev, loginPhone: phone, loginPassword: "" }));
      setShowForgotOptions(false);
      setForgotStep("request");
      setForgotCode("");
      setForgotNewPassword("");
      setForgotExpiresAt("");
      showMessage(data?.message || "Password reset successful. Please log in.", false);
    } catch (err) {
      showMessage(err.message || "Failed to reset password.", true);
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleLogout() {
    await persistSession("", null);
    setAuthFields((prev) => ({ ...prev, registerCountry: DEFAULT_FILTERS.country }));
    setActiveScreen("landing");
    setSelectedPlot(null);
    setSelectedPlotId("");
    showMessage("Logged out.", false);
  }

  function applyFilters() {
    setAppliedFilters({ ...draftFilters });
    setSearchPage(1);
    setActiveScreen("search");
    showMessage("Filters updated.", false);
  }

  function clearFilters() {
    const baseCountry = normalizeCountry(userProfile?.country);
    const nextFilters = { ...DEFAULT_FILTERS, country: baseCountry };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchPage(1);
    setOpenDropdown("");
    showMessage("Filters cleared.", false);
  }

  async function handleActivateAccount() {
    setPaying(true);
    try {
      const data = await api("/api/pay", {
        method: "POST",
        headers: createAuthHeaders(token, true)
      });
      showMessage(data.message || "Payment request started.", false);
      await loadStatus();
      await loadPayments();
      if (selectedPlotId) await loadPlotDetail(selectedPlotId);
    } catch (err) {
      showMessage(err.message || "Failed to start payment.", true);
    } finally {
      setPaying(false);
    }
  }

  function openPlot(item) {
    setSelectedPlotId(item.id);
    setActiveScreen("detail");
  }

  function setQuickCategory(value) {
    setDraftFilters((prev) => ({ ...prev, category: value }));
    setAppliedFilters((prev) => ({ ...prev, category: value }));
    setSearchPage(1);
  }

  async function openSupportLink(url, fallbackMessage) {
    try {
      await Linking.openURL(url);
    } catch (_err) {
      showMessage(fallbackMessage, true);
    }
  }

  function handleProfileMenuPress(title) {
    if (title === "Saved Listings") {
      setShowSupportCard(false);
      setShowNotificationsCard(false);
      setActiveScreen("search");
      showMessage("Opening saved listings.", false);
      return;
    }
    if (title === "Notifications") {
      setShowSupportCard(false);
      setShowNotificationsCard((prev) => !prev);
      return;
    }
    if (title === "List My Property") {
      setShowSupportCard(false);
      setShowNotificationsCard(false);
      showMessage("List My Property is coming soon.", false);
      return;
    }
    if (title === "Support") {
      setShowNotificationsCard(false);
      setShowSupportCard((prev) => !prev);
      return;
    }
    if (title === "Terms & Privacy") {
      setShowSupportCard(false);
      setShowNotificationsCard(false);
      openSupportLink(TERMS_PRIVACY_URL, "Could not open Terms & Privacy.");
      return;
    }
    if (title === "Delete Account") {
      setShowSupportCard(false);
      setShowNotificationsCard(false);
      openSupportLink(ACCOUNT_DELETION_URL, "Could not open Delete Account page.");
    }
  }

  function renderMessage() {
    if (!message.text) return null;
    return (
      <View style={[styles.toast, message.error ? styles.toastError : styles.toastSuccess]}>
        <Text style={styles.toastText}>{message.text}</Text>
      </View>
    );
  }

  function renderTopBar() {
    const country = appliedFilters.country || "Kenya";
    return (
      <View style={styles.topBar}>
        <View>
          <Text style={styles.countryText}>{country}</Text>
          {token ? (
            <Text style={styles.topBarTitle}>
              Find Your{"\n"}
              <Text style={styles.topBarAccent}>Perfect Space</Text>
            </Text>
          ) : null}
        </View>
        {token ? (
          <Pressable style={styles.avatarButton} onPress={() => setActiveScreen("account")}>
            <Text style={styles.avatarButtonText}>{getInitials(userProfile?.name || "User")}</Text>
          </Pressable>
        ) : (
          <Text style={styles.countryText}>{country}</Text>
        )}
      </View>
    );
  }

  function renderSearchBar(showInlineAction = true) {
    const placeholder = token ? "Search area, county, hostel..." : "you@example.com";
    return (
      <View style={styles.searchShell}>
        <TextInput
          style={styles.searchInput}
          value={token ? draftFilters.area : ""}
          onChangeText={(value) => {
            if (token) setDraftFilters((prev) => ({ ...prev, area: value }));
          }}
          placeholder={placeholder}
          placeholderTextColor="#60708f"
        />
        {showInlineAction ? (
          <Pressable style={styles.searchAction} onPress={token ? applyFilters : handleLogin} disabled={!token && authBusy}>
            <Text style={styles.searchActionText}>{token ? "Search" : authBusy ? "..." : "Log In"}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderPromoCard() {
    return (
      <View style={styles.promoCard}>
        <View style={styles.promoIcon}>
          <Text style={styles.promoIconText}>!</Text>
        </View>
        <View style={styles.promoBody}>
          <Text style={styles.promoTitle}>Unlock Contact Details</Text>
          <Text style={styles.promoText}>Activate for Ksh {ACCESS_FEE} • 24hr access</Text>
        </View>
        <Pressable
          style={styles.promoButton}
          onPress={() => {
            if (!token) {
              setActiveScreen("access");
              return;
            }
            handleActivateAccount();
          }}
          disabled={paying}
        >
          <Text style={styles.promoButtonText}>{status?.active ? "Active" : paying ? "..." : "Activate"}</Text>
        </Pressable>
      </View>
    );
  }

  function renderBrowseTypeChips() {
    return (
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>Browse By Type</Text>
        <View style={styles.chipRow}>
          {DISCOVER_CATEGORIES.map((option) => (
            <MiniChip
              key={option.label}
              label={option.label}
              active={(appliedFilters.category || "") === option.value}
              onPress={() => setQuickCategory(option.value)}
            />
          ))}
        </View>
      </View>
    );
  }

  function renderListingsSection(title, actionLabel) {
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>{title}</Text>
          {actionLabel ? (
            <Pressable onPress={() => setActiveScreen("search")}>
              <Text style={styles.seeAllText}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>

        {loadingPlots ? (
          <ActivityIndicator color="#18c7a0" size="large" style={styles.loadingState} />
        ) : featuredPlots.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>No listings match your current filters.</Text>
          </View>
        ) : (
          featuredPlots.map((item) => (
            <ListingCard key={String(item.id)} item={item} status={status} onPress={() => openPlot(item)} />
          ))
        )}
      </View>
    );
  }

  function renderHomeScreen() {
    return (
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        {renderTopBar()}
        {renderSearchBar(true)}
        {renderPromoCard()}
        {renderBrowseTypeChips()}
        {renderListingsSection("Nearby Listings", "See all")}
      </ScrollView>
    );
  }

  function renderSearchScreen() {
    const registeredCountry = normalizeCountry(userProfile?.country || draftFilters.country);
    const countyOptions = meta.countiesByCountry?.[registeredCountry] || counties;
    const selectedCounty = countyOptions.find(
      (option) => String(option).trim().toLowerCase() === String(draftFilters.county || "").trim().toLowerCase()
    ) || "";
    const areaOptions = selectedCounty ? meta.areasByCounty?.[selectedCounty] || [] : [];
    const categoryOptions = DISCOVER_CATEGORIES.concat(
      LISTING_CATEGORIES.filter((item) => !DISCOVER_CATEGORIES.some((option) => option.value === item)).map((item) => ({
        label: mapCategoryLabel(item),
        value: item
      }))
    );

    return (
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!openDropdown}
      >
        <View style={styles.searchFilterHeader}>
          <Text style={styles.screenTitle}>Search & Filter</Text>
        </View>

        <View style={styles.searchPanel}>
          <TextInput
            style={styles.searchInputWide}
            value={draftFilters.area}
            onChangeText={(area) => setDraftFilters((prev) => ({ ...prev, area }))}
            placeholder="Name, area, or county..."
            placeholderTextColor="#60708f"
          />

          <View style={styles.filterDoubleRow}>
            <SelectableInputField
              label="County / City"
              value={draftFilters.county}
              placeholder="All counties"
              options={countyOptions}
              isOpen={openDropdown === "county"}
              onFocus={() => setOpenDropdown("county")}
              onBlur={() => {}}
              onClose={() => setOpenDropdown("")}
              onChangeText={(county) => {
                setDraftFilters((prev) => ({ ...prev, county, area: "" }));
                setOpenDropdown("county");
              }}
              onSelect={(county) => {
                const selectedValue = countyOptions.find(
                  (option) => String(option).trim().toLowerCase() === String(county || "").trim().toLowerCase()
                ) || county;
                setDraftFilters((prev) => ({ ...prev, county: selectedValue, area: "" }));
                setOpenDropdown("");
              }}
              half
            />
            <SelectableInputField
              label="Area"
              value={draftFilters.area}
              placeholder="All areas"
              options={areaOptions}
              isOpen={openDropdown === "area"}
              onFocus={() => {
                if (!selectedCounty) {
                  showMessage("Select a county first.", true);
                  return;
                }
                setOpenDropdown("area");
              }}
              onBlur={() => {}}
              onClose={() => setOpenDropdown("")}
              onChangeText={(area) => {
                setDraftFilters((prev) => ({ ...prev, area }));
                setOpenDropdown("area");
              }}
              onSelect={(area) => {
                const selectedValue = areaOptions.find(
                  (option) => String(option).trim().toLowerCase() === String(area || "").trim().toLowerCase()
                ) || area;
                setDraftFilters((prev) => ({ ...prev, area: selectedValue }));
                setOpenDropdown("");
              }}
              half
            />
          </View>

          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {categoryOptions.map((option) => (
              <MiniChip
                key={`${option.label}-${option.value}`}
                label={option.label}
                active={(draftFilters.category || "") === option.value}
                onPress={() => setDraftFilters((prev) => ({ ...prev, category: option.value }))}
              />
            ))}
          </ScrollView>

          <View style={styles.filterDoubleRow}>
            <FilterField
              label="Min Price"
              value={draftFilters.minPrice}
              placeholder="Ksh 0"
              onChangeText={(minPrice) => setDraftFilters((prev) => ({ ...prev, minPrice }))}
              keyboardType="numeric"
              half
            />
            <FilterField
              label="Max Price"
              value={draftFilters.maxPrice}
              placeholder="Ksh 80"
              onChangeText={(maxPrice) => setDraftFilters((prev) => ({ ...prev, maxPrice }))}
              keyboardType="numeric"
              half
            />
          </View>

          <View style={styles.searchActionRow}>
            <Text style={styles.resultCountText}>
              {plots.length} listing{plots.length === 1 ? "" : "s"} found
            </Text>
            {plots.length > 0 ? (
              <Text style={styles.searchPageText}>
                Page {searchPage} of {totalSearchPages}
              </Text>
            ) : (
              <Pressable onPress={clearFilters}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.searchButtonsRow}>
            <Pressable style={[styles.outlineButton, styles.buttonFlex]} onPress={clearFilters}>
              <Text style={styles.outlineButtonText}>Reset</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.buttonFlex]} onPress={applyFilters}>
              <Text style={styles.primaryButtonText}>Apply</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          {loadingPlots ? (
            <ActivityIndicator color="#18c7a0" size="large" style={styles.loadingState} />
          ) : plots.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelText}>No listings available for these filters.</Text>
            </View>
          ) : (
            <>
              {paginatedPlots.map((item) => (
                <ListingCard key={String(item.id)} item={item} status={status} onPress={() => openPlot(item)} />
              ))}
              {totalSearchPages > 1 ? (
                <View style={styles.paginationRow}>
                  <Pressable
                    style={[styles.outlineButton, styles.paginationButton, searchPage === 1 && styles.paginationButtonDisabled]}
                    onPress={() => setSearchPage((prev) => Math.max(1, prev - 1))}
                    disabled={searchPage === 1}
                  >
                    <Text style={[styles.outlineButtonText, searchPage === 1 && styles.paginationButtonTextDisabled]}>Previous</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButton, styles.paginationButton, searchPage === totalSearchPages && styles.paginationButtonDisabled]}
                    onPress={() => setSearchPage((prev) => Math.min(totalSearchPages, prev + 1))}
                    disabled={searchPage === totalSearchPages}
                  >
                    <Text style={[styles.primaryButtonText, searchPage === totalSearchPages && styles.paginationButtonTextDisabled]}>Next</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  function renderDetailScreen() {
    const locationLine = getLocationLine(selectedPlot);
    return (
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.screenTitle}>Listing Details</Text>
          <Pressable style={styles.outlineButtonSmall} onPress={() => setActiveScreen("search")}>
            <Text style={styles.outlineButtonText}>Back</Text>
          </Pressable>
        </View>

        {loadingDetail ? (
          <ActivityIndicator color="#18c7a0" size="large" style={styles.loadingState} />
        ) : !selectedPlot ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>Select a listing from Search to view full details.</Text>
          </View>
        ) : (
          <View style={styles.detailCard}>
            <View style={styles.listingMediaRow}>
              <View style={styles.listingIllustrationWrap}>
                <View style={styles.listingIllustration}>
                  <Text style={styles.listingIllustrationText}>H</Text>
                </View>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>{formatPrice(selectedPlot.price)}</Text>
              </View>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.softBadge}>
                <Text style={styles.softBadgeText}>{mapCategoryLabel(selectedPlot.category)}</Text>
              </View>
              <View style={[styles.softBadge, styles.greenBadge]}>
                <Text style={[styles.softBadgeText, styles.greenBadgeText]}>{status?.active ? "Unlocked" : "Locked"}</Text>
              </View>
            </View>

            <Text style={styles.listingTitle}>{selectedPlot.title}</Text>
            <Text style={styles.listingLocation}>{locationLine || "Location not provided"}</Text>
            <Text style={styles.detailDescription}>{selectedPlot.description || "No description added yet."}</Text>

            <View style={styles.detailInfoCard}>
              <Text style={styles.detailInfoLabel}>Caretaker Phone</Text>
              <Text style={styles.detailInfoValue}>
                {selectedPlot.caretaker && selectedPlot.caretaker !== "Locked"
                  ? formatPhoneForTel(selectedPlot.caretaker)
                  : "Locked until activation"}
              </Text>
            </View>

            <View style={styles.detailInfoCard}>
              <Text style={styles.detailInfoLabel}>WhatsApp</Text>
              <Text style={styles.detailInfoValue}>
                {selectedPlot.whatsapp && selectedPlot.whatsapp !== "Locked"
                  ? formatPhoneForWhatsApp(selectedPlot.whatsapp)
                  : "Locked until activation"}
              </Text>
            </View>

            {!token ? (
              <Pressable style={styles.primaryButton} onPress={() => setActiveScreen("access")}>
                <Text style={styles.primaryButtonText}>Log In To Unlock Contacts</Text>
              </Pressable>
            ) : !status?.active ? (
              <Pressable style={styles.primaryButton} onPress={handleActivateAccount} disabled={paying}>
                <Text style={styles.primaryButtonText}>{paying ? "Starting Payment..." : "Activate Account"}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderPaymentsScreen() {
    return (
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.screenTitle}>Payments</Text>
          <Pressable
            style={styles.outlineButtonSmall}
            onPress={() => {
              loadStatus();
              loadPayments();
            }}
          >
            <Text style={styles.outlineButtonText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.paymentHero}>
          <Text style={styles.paymentHeroLabel}>Access Status</Text>
          <Text style={styles.paymentHeroValue}>{status?.active ? "Active" : "Inactive"}</Text>
          <Text style={styles.paymentHeroText}>{status?.active ? formatStatusCountdown(status) : "Activate for 24 hour access"}</Text>
        </View>

        <View style={styles.paymentActionCard}>
          <Text style={styles.paymentActionTitle}>Unlock contact details</Text>
          <Text style={styles.paymentActionText}>One tap M-Pesa activation for Ksh {ACCESS_FEE}.</Text>
          <Pressable style={styles.primaryButton} onPress={handleActivateAccount} disabled={paying}>
            <Text style={styles.primaryButtonText}>{paying ? "Starting Payment..." : "Activate Now"}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionEyebrow}>Recent Payments</Text>
          {loadingPayments ? (
            <ActivityIndicator color="#18c7a0" size="large" style={styles.loadingState} />
          ) : paymentLog.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelText}>No payment activity yet.</Text>
            </View>
          ) : (
            paymentLog.map((payment) => (
              <View key={String(payment.id)} style={styles.paymentItem}>
                <Text style={styles.paymentMainText}>{payment.status} • {formatPrice(payment.amount)}</Text>
                <Text style={styles.paymentSubText}>{new Date(payment.timestamp).toLocaleString()}</Text>
                {payment.mpesaReceipt ? <Text style={styles.paymentSubText}>Receipt: {payment.mpesaReceipt}</Text> : null}
                {payment.validationError ? <Text style={styles.errorText}>{payment.validationError}</Text> : null}
                {payment.validationWarning ? <Text style={styles.warningText}>{payment.validationWarning}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  function renderProfileScreen() {
    const accountName = userProfile?.name || "PlotConnect User";
    const accountId = userProfile?.displayId || userProfile?.id || userProfile?._id || "ID pending";
    const accountCountry = normalizeCountry(userProfile?.country || draftFilters.country);
    return (
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.accountHero}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>{getInitials(accountName)}</Text>
          </View>
          <View style={styles.accountHeroBody}>
            <Text style={styles.accountName}>{accountName}</Text>
            <Text style={styles.accountMeta}>{userProfile?.phone || "No phone saved"} • ID: {accountId}</Text>
          </View>
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.filterLabel}>Your Country</Text>
          <TextInput
            style={styles.filterInput}
            value={accountCountry}
            editable={false}
            placeholder="Kenya"
            placeholderTextColor="#627294"
          />
        </View>

        {[
          { title: "Saved Listings", subtitle: `${plots.length} properties nearby` },
          { title: "Notifications", subtitle: status?.active ? "Access is active" : "2 new alerts" },
          { title: "List My Property", subtitle: "Reach thousands of seekers" },
          { title: "Support", subtitle: "Get help fast" },
          { title: "Terms & Privacy", subtitle: "Legal information" },
          { title: "Delete Account", subtitle: "Request account and data deletion" }
        ].map((item) => (
          <Pressable key={item.title} style={styles.accountMenuCard} onPress={() => handleProfileMenuPress(item.title)}>
            <View>
              <Text style={styles.accountMenuTitle}>{item.title}</Text>
              <Text style={styles.accountMenuText}>{item.subtitle}</Text>
            </View>
            <Text style={styles.accountMenuArrow}>{">"}</Text>
          </Pressable>
        ))}

        {showNotificationsCard ? (
          <View style={styles.notificationsCard}>
            <Text style={styles.sectionEyebrow}>Notifications</Text>
            {PROFILE_NOTIFICATIONS.map((item) => (
              <View key={item.title} style={styles.notificationItem}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationText}>{item.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {showSupportCard ? (
          <View style={styles.supportCard}>
            <View style={styles.supportHeader}>
              <View style={styles.supportBadge}>
                <MaterialCommunityIcons name="headset" size={18} color="#ffffff" />
              </View>
              <View style={styles.supportHeaderBody}>
                <Text style={styles.sectionEyebrow}>Support</Text>
                <Text style={styles.supportTitle}>We are here when you need us</Text>
                <Text style={styles.supportCaption}>Reach PlotConnect support by email, call, WhatsApp, Facebook, or Instagram.</Text>
              </View>
            </View>

            <View style={styles.supportContactRow}>
              <View style={styles.supportContactChip}>
                <MaterialCommunityIcons name="email-outline" size={16} color="#8fe8ff" />
                <Text style={styles.supportContactText}>{SUPPORT_EMAIL}</Text>
              </View>
              <View style={styles.supportContactChip}>
                <MaterialCommunityIcons name="phone-outline" size={16} color="#8fe8ff" />
                <Text style={styles.supportContactText}>{SUPPORT_PHONE}</Text>
              </View>
            </View>

            <View style={styles.supportActions}>
              <Pressable
                style={styles.supportActionButton}
                onPress={() => openSupportLink(`mailto:${SUPPORT_EMAIL}?subject=Support Request - TST PlotConnect`, "Could not open email app.")}
              >
                <View style={styles.supportActionIconWrap}>
                  <MaterialCommunityIcons name="email-fast-outline" size={20} color="#ffffff" />
                </View>
                <Text style={styles.supportActionText}>Email</Text>
              </Pressable>
              <Pressable
                style={styles.supportActionButton}
                onPress={() => openSupportLink(`tel:${SUPPORT_PHONE}`, "Could not start the phone call.")}
              >
                <View style={styles.supportActionIconWrap}>
                  <MaterialCommunityIcons name="phone" size={18} color="#ffffff" />
                </View>
                <Text style={styles.supportActionText}>Call</Text>
              </Pressable>
              <Pressable
                style={styles.supportActionButton}
                onPress={() =>
                  openSupportLink(
                    `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hello, I need help with TST PlotConnect.")}`,
                    "Could not open WhatsApp."
                  )
                }
              >
                <View style={[styles.supportActionIconWrap, styles.supportActionIconWhatsApp]}>
                  <FontAwesome name="whatsapp" size={20} color="#ffffff" />
                </View>
                <Text style={styles.supportActionText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={styles.supportActionButton}
                onPress={() => openSupportLink(SUPPORT_FACEBOOK, "Could not open Facebook.")}
              >
                <View style={[styles.supportActionIconWrap, styles.supportActionIconFacebook]}>
                  <FontAwesome name="facebook-f" size={18} color="#ffffff" />
                </View>
                <Text style={styles.supportActionText}>Facebook</Text>
              </Pressable>
              <Pressable
                style={styles.supportActionButton}
                onPress={() => openSupportLink(SUPPORT_INSTAGRAM, "Could not open Instagram.")}
              >
                <View style={[styles.supportActionIconWrap, styles.supportActionIconInstagram]}>
                  <FontAwesome name="instagram" size={19} color="#ffffff" />
                </View>
                <Text style={styles.supportActionText}>Instagram</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable style={styles.outlineDangerButton} onPress={handleLogout}>
          <Text style={styles.outlineDangerText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    );
  }

  function renderAccessScreen() {
    const countryOptions = meta.countries.length ? meta.countries : SUPPORTED_COUNTRIES;
    return (
      <ScrollView contentContainerStyle={styles.accessContent} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => {
            setActiveScreen("landing");
            setShowForgotOptions(false);
            setForgotStep("request");
            setForgotCode("");
            setForgotNewPassword("");
            setForgotExpiresAt("");
          }}
        >
          <Text style={styles.backText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.accessTitle}>Welcome back</Text>
        <Text style={styles.accessSubtitle}>Sign in with your phone number and password</Text>

        <View style={styles.authModeRow}>
          <MiniChip label="Login" active={authMode === "login"} onPress={() => setAuthMode("login")} />
          <MiniChip label="Register" active={authMode === "register"} onPress={() => setAuthMode("register")} />
        </View>

        {authMode === "login" ? (
          <>
            <FilterField
              label="Phone Number"
              value={authFields.loginPhone}
              placeholder="Phone number"
              onChangeText={(loginPhone) => setAuthFields((prev) => ({ ...prev, loginPhone }))}
            />
            <FilterField
              label="Password"
              value={authFields.loginPassword}
              placeholder="Password"
              onChangeText={(loginPassword) => setAuthFields((prev) => ({ ...prev, loginPassword }))}
            />
            <Pressable
              onPress={() => {
                setShowForgotOptions((prev) => !prev);
                setForgotPhone(authFields.loginPhone);
                setForgotStep("request");
                setForgotCode("");
                setForgotNewPassword("");
                setForgotExpiresAt("");
              }}
            >
              <Text style={styles.forgotText}>{showForgotOptions ? "Back to login" : "Forgot password?"}</Text>
            </Pressable>

            {showForgotOptions ? (
              <View style={styles.forgotCard}>
                <FilterField
                  label="Phone Number"
                  value={forgotPhone}
                  placeholder="07xxxxxxxx"
                  onChangeText={setForgotPhone}
                />

                {forgotStep === "verify" ? (
                  <>
                    <FilterField
                      label="OTP Code"
                      value={forgotCode}
                      placeholder="Enter OTP code"
                      onChangeText={setForgotCode}
                      keyboardType="numeric"
                    />
                    <FilterField
                      label="New Password"
                      value={forgotNewPassword}
                      placeholder="Enter new password"
                      onChangeText={setForgotNewPassword}
                    />
                    {forgotExpiresAt ? (
                      <Text style={styles.forgotHelpText}>
                        OTP expires at {new Date(forgotExpiresAt).toLocaleTimeString()}.
                      </Text>
                    ) : null}
                    <Pressable style={styles.loginButton} onPress={handleVerifyPasswordResetCode} disabled={forgotBusy}>
                      <Text style={styles.loginButtonText}>{forgotBusy ? "Resetting..." : "Reset Password"}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.forgotHelpText}>We will send an OTP code to your phone.</Text>
                    <Pressable style={styles.loginButton} onPress={handleRequestPasswordResetCode} disabled={forgotBusy}>
                      <Text style={styles.loginButtonText}>{forgotBusy ? "Sending..." : "Send OTP Code"}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}

            <Pressable style={styles.loginButton} onPress={handleLogin} disabled={authBusy || showForgotOptions}>
              <Text style={styles.loginButtonText}>{authBusy ? "Signing in..." : "Log In"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <FilterField
              label="Full Name"
              value={authFields.registerName}
              placeholder="Your full name"
              onChangeText={(registerName) => setAuthFields((prev) => ({ ...prev, registerName }))}
            />
            <Text style={styles.filterLabel}>Country</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {countryOptions.map((country) => (
                <MiniChip
                  key={country}
                  label={country}
                  active={normalizeCountry(authFields.registerCountry) === country}
                  onPress={() => setAuthFields((prev) => ({ ...prev, registerCountry: country }))}
                />
              ))}
            </ScrollView>
            <FilterField
              label="Phone Number"
              value={authFields.registerPhone}
              placeholder="Safaricom phone"
              onChangeText={(registerPhone) => setAuthFields((prev) => ({ ...prev, registerPhone }))}
            />
            <FilterField
              label="Password"
              value={authFields.registerPassword}
              placeholder="Create password"
              onChangeText={(registerPassword) => setAuthFields((prev) => ({ ...prev, registerPassword }))}
            />
            <Pressable style={styles.loginButton} onPress={handleRegister} disabled={authBusy}>
              <Text style={styles.loginButtonText}>{authBusy ? "Creating account..." : "Create Account"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    );
  }

  function renderLandingScreen() {
    return (
      <View style={styles.landingWrap}>
        <View style={styles.landingOrbOne} />
        <View style={styles.landingOrbTwo} />
        <View style={styles.landingContent}>
          <View style={styles.landingLogo}>
            <Text style={styles.landingLogoText}>🏠</Text>
          </View>

          <Text style={styles.landingTitle}>
            TST <Text style={styles.topBarAccent}>PlotConnect</Text>
          </Text>
          <Text style={styles.landingSubtitle}>
            Discover verified hostels, bedsitters & lodges across East Africa
          </Text>

          <Pressable style={styles.landingPrimaryButton} onPress={() => setActiveScreen("access")}>
            <Text style={styles.landingPrimaryButtonText}>Get Started</Text>
          </Pressable>


          <Text style={styles.landingFooterText}>Safe · Verified · Affordable · East Africa</Text>
        </View>
      </View>
    );
  }

  function renderBottomTabs() {
    if (!token) return null;
    const canNavigate = Boolean(token);
    return (
      <View style={styles.bottomTabs}>
        <TabButton
          label="Explore"
          icon="⌂"
          active={canNavigate && activeScreen === "home"}
          onPress={() => {
            if (canNavigate) setActiveScreen("home");
          }}
        />
        <TabButton
          label="Search"
          icon="⌕"
          active={canNavigate && (activeScreen === "search" || activeScreen === "detail")}
          onPress={() => {
            if (canNavigate) setActiveScreen("search");
          }}
        />
        <TabButton
          label="Payments"
          icon="◫"
          active={canNavigate && activeScreen === "payments"}
          onPress={() => {
            if (canNavigate) setActiveScreen("payments");
          }}
        />
        <TabButton
          label="Profile"
          icon="◉"
          active={canNavigate && activeScreen === "account"}
          onPress={() => {
            if (canNavigate) setActiveScreen("account");
          }}
        />
      </View>
    );
  }

  function renderCurrentScreen() {
    if (!token && activeScreen === "access") return renderAccessScreen();
    if (!token) return renderLandingScreen();
    if (activeScreen === "payments") return renderPaymentsScreen();
    if (activeScreen === "account") return renderProfileScreen();
    if (activeScreen === "detail") return renderDetailScreen();
    if (activeScreen === "search") return renderSearchScreen();
    return renderHomeScreen();
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <ExpoStatusBar style="light" />
        <View style={styles.appShell}>
          <View style={styles.bgOrbLarge} />
          <View style={styles.bgOrbSmall} />
          {renderMessage()}
          <View style={styles.phoneFrame}>{renderCurrentScreen()}</View>
          {renderBottomTabs()}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0a1020"
  },
  appShell: {
    flex: 1,
    backgroundColor: "#0a1020"
  },
  bgOrbLarge: {
    position: "absolute",
    top: -20,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(24, 199, 160, 0.12)"
  },
  bgOrbSmall: {
    position: "absolute",
    top: 260,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(70, 214, 235, 0.08)"
  },
  phoneFrame: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 28,
    backgroundColor: "#0c1326",
    borderWidth: 1,
    borderColor: "#18253f",
    overflow: "hidden"
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 16
  },
  accessContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 40
  },
  landingWrap: {
    flex: 1,
    backgroundColor: "#111a31",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingBottom: 110,
    overflow: "hidden"
  },
  landingOrbOne: {
    position: "absolute",
    top: 64,
    left: -22,
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: "rgba(24, 199, 160, 0.12)"
  },
  landingOrbTwo: {
    position: "absolute",
    top: -30,
    right: -40,
    width: 250,
    height: 250,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)"
  },
  landingContent: {
    alignItems: "center"
  },
  landingLogo: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: "#18c7a0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#18c7a0",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  landingLogoText: {
    fontSize: 32
  },
  landingTitle: {
    marginTop: 26,
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800"
  },
  landingSubtitle: {
    marginTop: 14,
    color: "#b8c3d7",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 250
  },
  landingPrimaryButton: {
    marginTop: 44,
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#18c7a0",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  landingPrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15
  },
  landingSecondaryButton: {
    marginTop: 12,
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#24304c",
    borderWidth: 1,
    borderColor: "#32405f",
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center"
  },
  landingSecondaryButtonText: {
    color: "#f0f4fa",
    fontWeight: "700",
    fontSize: 14
  },
  landingFooterText: {
    marginTop: 28,
    color: "#5f6b87",
    fontSize: 11,
    textAlign: "center"
  },
  toast: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 20,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 260
  },
  toastSuccess: {
    backgroundColor: "rgba(49, 196, 141, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(49, 196, 141, 0.35)"
  },
  toastError: {
    backgroundColor: "rgba(240, 95, 95, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(240, 95, 95, 0.35)"
  },
  toastText: {
    color: "#f5f7fb",
    fontSize: 13
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  countryText: {
    color: "#b0bbd5",
    fontSize: 12
  },
  topBarTitle: {
    marginTop: 8,
    color: "#f8fbff",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800"
  },
  topBarAccent: {
    color: "#46d6eb"
  },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#1d2943",
    borderWidth: 1,
    borderColor: "#2b3959",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarButtonText: {
    color: "#7be7ef",
    fontWeight: "800",
    fontSize: 14
  },
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: "#243254",
    paddingLeft: 14,
    paddingRight: 8,
    minHeight: 58
  },
  searchInput: {
    flex: 1,
    color: "#f8fbff",
    fontSize: 14,
    paddingVertical: 14
  },
  searchAction: {
    backgroundColor: "#18c7a0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  searchActionText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13
  },
  promoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#11272c",
    borderWidth: 1,
    borderColor: "#1d4c55",
    padding: 14
  },
  promoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#18c7a0",
    alignItems: "center",
    justifyContent: "center"
  },
  promoIconText: {
    color: "#101521",
    fontSize: 18,
    fontWeight: "900"
  },
  promoBody: {
    flex: 1
  },
  promoTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  promoText: {
    marginTop: 4,
    color: "#aeb8cf",
    fontSize: 12
  },
  promoButton: {
    backgroundColor: "#18c7a0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  promoButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13
  },
  sectionBlock: {
    gap: 12
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionEyebrow: {
    color: "#b2bdd6",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  seeAllText: {
    color: "#46d6eb",
    fontSize: 12,
    fontWeight: "700"
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 10
  },
  miniChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#283654",
    backgroundColor: "#10192f",
    paddingHorizontal: 15,
    paddingVertical: 10
  },
  miniChipActive: {
    backgroundColor: "#18c7a0",
    borderColor: "#18c7a0"
  },
  miniChipText: {
    color: "#c6d0e5",
    fontSize: 12,
    fontWeight: "700"
  },
  miniChipTextActive: {
    color: "#ffffff"
  },
  listingCard: {
    borderRadius: 24,
    backgroundColor: "#202d4a",
    borderWidth: 1,
    borderColor: "#2a3859",
    padding: 14
  },
  listingMediaRow: {
    position: "relative",
    marginBottom: 12
  },
  listingIllustrationWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: 4
  },
  listingMediaFallback: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  listingImageWrap: {
    width: "100%",
    height: 158,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#162039",
    position: "relative"
  },
  listingImage: {
    width: "100%",
    height: "100%"
  },
  listingImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 16, 31, 0.28)",
    borderRadius: 22
  },
  listingIllustration: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#ead5b5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#c4a278"
  },
  listingIllustrationText: {
    color: "#873f1e",
    fontSize: 34,
    fontWeight: "900"
  },
  priceBadge: {
    minWidth: 70,
    borderRadius: 12,
    backgroundColor: "#18c7a0",
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: "center"
  },
  priceBadgeText: {
    color: "#fff7f0",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center"
  },
  priceBadgeFloating: {
    position: "absolute",
    top: 14,
    right: 14,
    minWidth: 92,
    borderRadius: 14,
    backgroundColor: "#18c7a0",
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0b1a2e",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  priceBadgeInline: {
    alignSelf: "flex-start",
    minWidth: 92,
    borderRadius: 14,
    backgroundColor: "#18c7a0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  softBadge: {
    borderRadius: 999,
    backgroundColor: "#17383d",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  softBadgeText: {
    color: "#8ef5ff",
    fontSize: 11,
    fontWeight: "700"
  },
  greenBadge: {
    backgroundColor: "#23483f"
  },
  greenBadgeText: {
    color: "#8ef0b9"
  },
  listingTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800"
  },
  listingLocation: {
    marginTop: 6,
    color: "#c1cadd",
    fontSize: 13
  },
  listingDescription: {
    marginTop: 8,
    color: "#aeb8cf",
    fontSize: 13,
    lineHeight: 19
  },
  listingFooterRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  listingMetaText: {
    color: "#83edf6",
    fontSize: 12
  },
  ratingText: {
    color: "#83edf6",
    fontSize: 12
  },
  lockBanner: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#18333a",
    borderWidth: 1,
    borderColor: "#25525a",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  lockBannerText: {
    color: "#8ef5ff",
    fontSize: 12,
    fontWeight: "700"
  },
  searchFilterHeader: {
    marginBottom: -2
  },
  screenTitle: {
    color: "#f8fbff",
    fontSize: 23,
    fontWeight: "800"
  },
  searchPanel: {
    borderRadius: 24,
    backgroundColor: "#111a31",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 14,
    gap: 12
  },
  searchInputWide: {
    borderRadius: 14,
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: "#243254",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#f8fbff"
  },
  filterLabel: {
    color: "#8f9bb7",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700"
  },
  filterDoubleRow: {
    flexDirection: "row",
    gap: 10
  },
  filterField: {
    gap: 8,
    position: "relative",
    zIndex: 1
  },
  filterFieldOpen: {
    zIndex: 60
  },
  filterFieldHalf: {
    flex: 1
  },
  filterInput: {
    borderRadius: 14,
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: "#243254",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#f8fbff"
  },
  dropdownTrigger: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: "#243254",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  dropdownInput: {
    flex: 1,
    color: "#f8fbff",
    paddingVertical: 0
  },
  dropdownTriggerText: {
    flex: 1,
    color: "#f8fbff"
  },
  dropdownPlaceholderText: {
    color: "#7c88a4"
  },
  dropdownChevron: {
    color: "#8fdfe8",
    fontSize: 16,
    fontWeight: "700"
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 10, 20, 0.62)",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  dropdownModalCard: {
    borderRadius: 20,
    backgroundColor: "#162039",
    borderWidth: 1,
    borderColor: "#243254",
    overflow: "hidden",
    maxHeight: "72%",
    shadowColor: "#08101f",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 24
  },
  dropdownModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12
  },
  dropdownModalLabel: {
    color: "#f8fbff",
    fontSize: 15,
    fontWeight: "800"
  },
  dropdownModalClose: {
    color: "#8fdfe8",
    fontSize: 13,
    fontWeight: "700"
  },
  dropdownModalInput: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: "#243254",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#f8fbff"
  },
  dropdownScroll: {
    maxHeight: 260
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#22304f"
  },
  dropdownOptionText: {
    color: "#e4edfa",
    fontSize: 13
  },
  dropdownOptionDisabled: {
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  dropdownOptionDisabledText: {
    color: "#7c88a4",
    fontSize: 13
  },
  helperWrap: {
    borderRadius: 12,
    backgroundColor: "#162039",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  helperText: {
    color: "#93a4c7",
    fontSize: 12,
    lineHeight: 18
  },
  searchActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  resultCountText: {
    color: "#d6deee",
    fontSize: 13,
    fontWeight: "700"
  },
  searchPageText: {
    color: "#8c98b5",
    fontSize: 12,
    fontWeight: "700"
  },
  clearText: {
    color: "#8c98b5",
    fontSize: 12,
    fontWeight: "700"
  },
  searchButtonsRow: {
    flexDirection: "row",
    gap: 10
  },
  buttonFlex: {
    flex: 1
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#18c7a0",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  outlineButton: {
    borderRadius: 16,
    backgroundColor: "#162039",
    borderWidth: 1,
    borderColor: "#293655",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  outlineButtonSmall: {
    borderRadius: 14,
    backgroundColor: "#162039",
    borderWidth: 1,
    borderColor: "#293655",
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  outlineButtonText: {
    color: "#d4dcf0",
    fontWeight: "700"
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4
  },
  paginationButton: {
    flex: 1
  },
  paginationButtonDisabled: {
    opacity: 0.45
  },
  paginationButtonTextDisabled: {
    color: "#9aa6c2"
  },
  emptyPanel: {
    borderRadius: 20,
    backgroundColor: "#131c34",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 18
  },
  emptyPanelText: {
    color: "#acb8d2",
    textAlign: "center",
    lineHeight: 20
  },
  loadingState: {
    marginVertical: 20
  },
  detailCard: {
    borderRadius: 24,
    backgroundColor: "#111a31",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 16,
    gap: 12
  },
  detailDescription: {
    color: "#d9e1f3",
    fontSize: 14,
    lineHeight: 22
  },
  detailInfoCard: {
    borderRadius: 16,
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: "#243254",
    padding: 14,
    gap: 6
  },
  detailInfoLabel: {
    color: "#91a0c2",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700"
  },
  detailInfoValue: {
    color: "#ffffff",
    fontWeight: "700",
    lineHeight: 20
  },
  paymentHero: {
    borderRadius: 24,
    backgroundColor: "#1b2846",
    borderWidth: 1,
    borderColor: "#2a3859",
    padding: 18
  },
  paymentHeroLabel: {
    color: "#97a6c6",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700"
  },
  paymentHeroValue: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800"
  },
  paymentHeroText: {
    marginTop: 6,
    color: "#c1cadd",
    lineHeight: 20
  },
  paymentActionCard: {
    borderRadius: 22,
    backgroundColor: "#111a31",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 16,
    gap: 10
  },
  paymentActionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800"
  },
  paymentActionText: {
    color: "#bfcae0",
    lineHeight: 20
  },
  paymentItem: {
    borderRadius: 18,
    backgroundColor: "#131c34",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 14,
    gap: 5
  },
  paymentMainText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  paymentSubText: {
    color: "#b0bbd5",
    fontSize: 12
  },
  accountHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#1b2742",
    borderWidth: 1,
    borderColor: "#263452"
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#18c7a0",
    alignItems: "center",
    justifyContent: "center"
  },
  accountAvatarText: {
    color: "#112039",
    fontSize: 16,
    fontWeight: "900"
  },
  accountHeroBody: {
    flex: 1
  },
  accountName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800"
  },
  accountMeta: {
    marginTop: 4,
    color: "#aeb8cf",
    fontSize: 12
  },
  accountCard: {
    borderRadius: 20,
    backgroundColor: "#131c34",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 14,
    gap: 8
  },
  accountMenuCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    backgroundColor: "#1b2742",
    borderWidth: 1,
    borderColor: "#263452",
    padding: 16
  },
  accountMenuTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700"
  },
  accountMenuText: {
    marginTop: 4,
    color: "#95a4c4",
    fontSize: 12
  },
  accountMenuArrow: {
    color: "#8f9bb7",
    fontSize: 16,
    fontWeight: "700"
  },
  notificationsCard: {
    borderRadius: 20,
    backgroundColor: "#131c34",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 16,
    gap: 12
  },
  notificationItem: {
    borderRadius: 16,
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: "#243254",
    padding: 14,
    gap: 6
  },
  notificationTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  notificationText: {
    color: "#aeb8cf",
    fontSize: 12,
    lineHeight: 18
  },
  supportCard: {
    borderRadius: 24,
    backgroundColor: "#123e56",
    borderWidth: 1,
    borderColor: "#1d6a82",
    padding: 18,
    gap: 14
  },
  supportHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start"
  },
  supportBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#1cc8a3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0b1a2e",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  supportHeaderBody: {
    flex: 1,
    gap: 4
  },
  supportTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800"
  },
  supportCaption: {
    color: "#c8e6ef",
    fontSize: 13,
    lineHeight: 19
  },
  supportContactRow: {
    gap: 10
  },
  supportContactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  supportContactText: {
    color: "#f5fbff",
    fontSize: 15,
    fontWeight: "700"
  },
  supportActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  supportActionButton: {
    width: "48%",
    minHeight: 86,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,21,39,0.18)",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 10
  },
  supportActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  supportActionIconWhatsApp: {
    backgroundColor: "#25D366"
  },
  supportActionIconFacebook: {
    backgroundColor: "#1877F2"
  },
  supportActionIconInstagram: {
    backgroundColor: "#E1306C"
  },
  supportActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  faqCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    backgroundColor: "#131c34",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 16
  },
  faqText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  outlineDangerButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6b3540",
    backgroundColor: "#26151a",
    paddingVertical: 15,
    alignItems: "center"
  },
  outlineDangerText: {
    color: "#ff9aa8",
    fontWeight: "800"
  },
  backText: {
    color: "#c9d2e6",
    fontSize: 18,
    marginBottom: 28
  },
  accessTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800"
  },
  accessSubtitle: {
    marginTop: 10,
    color: "#aeb8cf",
    fontSize: 15,
    marginBottom: 26
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18
  },
  socialButton: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: "#1c2742",
    borderWidth: 1,
    borderColor: "#2a3859",
    paddingVertical: 15,
    alignItems: "center"
  },
  socialButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#22304f"
  },
  orText: {
    color: "#7f8ba8",
    fontSize: 12
  },
  authModeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18
  },
  forgotText: {
    color: "#46d6eb",
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    marginTop: -2,
    marginBottom: 18
  },
  forgotCard: {
    borderRadius: 18,
    backgroundColor: "#131c34",
    borderWidth: 1,
    borderColor: "#202d49",
    padding: 14,
    gap: 12,
    marginBottom: 18
  },
  forgotHelpText: {
    color: "#aeb8cf",
    fontSize: 12,
    lineHeight: 18
  },
  loginButton: {
    borderRadius: 18,
    backgroundColor: "#18c7a0",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  signupText: {
    marginTop: 18,
    color: "#aeb8cf",
    textAlign: "center",
    fontSize: 13
  },
  bottomTabs: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#141e36",
    borderWidth: 1,
    borderColor: "#1f2b48"
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 62,
    gap: 6
  },
  tabIcon: {
    color: "#6f7e9c",
    fontSize: 18,
    fontWeight: "700"
  },
  tabIconActive: {
    color: "#18c7a0"
  },
  tabLabel: {
    color: "#6f7e9c",
    fontSize: 11
  },
  tabLabelActive: {
    color: "#18c7a0",
    fontWeight: "700"
  },
  errorText: {
    color: "#ff9aa8",
    fontSize: 12
  },
  warningText: {
    color: "#7be7ef",
    fontSize: 12
  }
});

import React from "react";
import ProfileSection from "@/components/account/profile/ProfileSection";

/** Kept for backwards compatibility — renders the full profile section. */
export default function ProfileDetails({ user, compact = false }) {
  return <ProfileSection user={user} compact={compact} />;
}

const optMode = {
  OPT_IN: "OPT_IN",
  OPT_OUT: "OPT_OUT",
}

const mailType = {
  // Opt-out
  OPT_OUT_INVITE: "OPT_OUT_INVITE",
  OPT_OUT_UNSUBSCRIPTION_CONFIRMATION: "OPT_OUT_UNSUBSCRIPTION_CONFIRMATION",
  OPT_OUT_STARTING: "OPT_OUT_STARTING",
  // Premium Parcoursup
  PREMIUM_INVITE: "PREMIUM_INVITE",
  PREMIUM_INVITE_ONE_SHOT_2023: "PREMIUM_INVITE_ONE_SHOT_2023",
  PREMIUM_INVITE_FOLLOW_UP: "PREMIUM_INVITE_FOLLOW_UP",
  PREMIUM_ACTIVATED_REMINDER: "PREMIUM_ACTIVATED_REMINDER",
  PREMIUM_REFUSED: "PREMIUM_REFUSED",
  PREMIUM_STARTING: "PREMIUM_STARTING",
  // Premium Affelnet
  PREMIUM_AFFELNET_INVITE: "PREMIUM_AFFELNET_INVITE",
  PREMIUM_AFFELNET_INVITE_ONE_SHOT_2023: "PREMIUM_AFFELNET_INVITE_ONE_SHOT_2023",
  PREMIUM_AFFELNET_INVITE_FOLLOW_UP: "PREMIUM_AFFELNET_INVITE_FOLLOW_UP",
  PREMIUM_AFFELNET_ACTIVATED_REMINDER: "PREMIUM_AFFELNET_ACTIVATED_REMINDER",
  PREMIUM_AFFELNET_REFUSED: "PREMIUM_AFFELNET_REFUSED",
  PREMIUM_AFFELNET_STARTING: "PREMIUM_AFFELNET_STARTING",
}

export { optMode, mailType }

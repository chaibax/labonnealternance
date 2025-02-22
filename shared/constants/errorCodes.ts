export enum BusinessErrorCodes {
  IS_CFA = "IS_CFA",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
  CLOSED = "CLOSED",
  NON_DIFFUSIBLE = "NON_DIFFUSIBLE",
  UNKNOWN = "UNKNOWN",
  UNSUPPORTED = "UNSUPPORTED",
  NOT_QUALIOPI = "NOT_QUALIOPI",
  TOO_MANY_APPLICATIONS_PER_DAY = "Maximum application per day reached",
  TOO_MANY_APPLICATIONS_PER_OFFER = "Maximum application per offer reached",
  TOO_MANY_APPLICATIONS_PER_SIRET = "Maximum application per recruiter reached",
  FILE_TYPE_NOT_SUPPORTED = "File type is not supported",
  BURNER = "Disposable email are not allowed",
  NOTFOUND = "Job or recruiter not found",
  EXPIRED = "Job offer has expired",
  INTERNAL_EMAIL = "Internal error: no contact email found for the corresponding ressource",
  ROMEO_NOT_FOUND = "Une erreur est survenue lors de la récupération du code ROME à partir du titre de l'offre",
  GEOLOCATION_NOT_FOUND = "Une erreur est survenue lors de la récupération de la géolocalisation à partir de l'adresse de l'entreprise",
}

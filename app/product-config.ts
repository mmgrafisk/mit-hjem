export const productConfig = {
  name: "Mit hjem",
  defaultTemplate: "command" as const,
  templates: {
    command: {
      name: "Klar blå",
      description: "Den valgte blå/mint command-center retning",
    },
    calm: {
      name: "Rolig grøn",
      description: "Lysere og mere afdæmpet til daglig brug",
    },
    journal: {
      name: "Midnatsjournal",
      description: "Mørk navigation med varme papirflader",
    },
  },
} as const;

export type TemplateName = keyof typeof productConfig.templates;

export const supportedLanguages = [
  ["da", "Dansk"],
  ["en", "English"],
  ["sv", "Svenska"],
  ["nb", "Norsk"],
  ["fi", "Suomi"],
  ["is", "Íslenska"],
  ["de", "Deutsch"],
  ["nl", "Nederlands"],
  ["fr", "Français"],
  ["es", "Español"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["pl", "Polski"],
  ["cs", "Čeština"],
  ["sk", "Slovenčina"],
  ["hu", "Magyar"],
  ["ro", "Română"],
  ["tr", "Türkçe"],
] as const;

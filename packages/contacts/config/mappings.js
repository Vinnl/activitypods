const CONTACT_REQUEST_MAPPING = {
  key: 'contact_request',
  title: {
    en: `{{{emitterProfile.vcard:given-name}}} would like to connect with you`,
    fr: `{{{emitterProfile.vcard:given-name}}} souhaiterait se connecter avec vous`
  },
  description: `{{activity.content}}`,
  actionName: {
    en: 'View',
    fr: 'Voir'
  },
  actionLink: '?type=as:Profile'
};

const ACCEPT_CONTACT_REQUEST_MAPPING = {
  key: 'accept_contact_request',
  title: {
    en: `{{{emitterProfile.vcard:given-name}}} is now part of your network`,
    fr: `{{{emitterProfile.vcard:given-name}}} fait maintenant partie de votre réseau`
  },
  description: {
    en: `{{{emitterProfile.vcard:given-name}}} has accepted your contact requests`,
    fr: `{{{emitterProfile.vcard:given-name}}} a accepté votre demande de mise en relation`
  },
  actionName: {
    en: 'View',
    fr: 'Voir'
  },
  actionLink: '?type=as:Profile&uri={{encodeUri emitterProfile.id}}'
};

module.exports = {
  CONTACT_REQUEST_MAPPING,
  ACCEPT_CONTACT_REQUEST_MAPPING
};

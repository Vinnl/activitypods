const { ACTIVITY_TYPES, OBJECT_TYPES } = require('@semapps/activitypub');

const INVITE_EVENT = {
  type: ACTIVITY_TYPES.INVITE,
  object: {
    type: OBJECT_TYPES.EVENT
  }
};

const OFFER_INVITE_EVENT = {
  type: ACTIVITY_TYPES.OFFER,
  object: {
    type: ACTIVITY_TYPES.INVITE,
    object: {
      type: OBJECT_TYPES.EVENT
    }
  }
};

const JOIN_EVENT = {
  type: ACTIVITY_TYPES.JOIN,
  object: {
    type: OBJECT_TYPES.EVENT
  }
};

const LEAVE_EVENT = {
  type: ACTIVITY_TYPES.LEAVE,
  object: {
    type: OBJECT_TYPES.EVENT
  }
};

const ANNOUNCE_UPDATE_EVENT = {
  type: ACTIVITY_TYPES.ANNOUNCE,
  object: {
    type: ACTIVITY_TYPES.UPDATE,
    object: {
      type: OBJECT_TYPES.EVENT
    }
  }
};

module.exports = {
  INVITE_EVENT,
  OFFER_INVITE_EVENT,
  JOIN_EVENT,
  LEAVE_EVENT,
  ANNOUNCE_UPDATE_EVENT
};
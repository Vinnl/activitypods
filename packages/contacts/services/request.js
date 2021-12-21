const { ACTIVITY_TYPES, ACTOR_TYPES, ActivitiesHandlerMixin } = require('@semapps/activitypub');
const {
  CONTACT_REQUEST,
  ACCEPT_CONTACT_REQUEST,
  REJECT_CONTACT_REQUEST,
  IGNORE_CONTACT_REQUEST,
} = require('../patterns');
const { defaultToArray } = require('@semapps/ldp/utils');

module.exports = {
  name: 'contacts.request',
  mixins: [ActivitiesHandlerMixin],
  dependencies: ['activitypub.registry', 'webacl'],
  async started() {
    await this.broker.call('activitypub.registry.register', {
      path: '/contacts',
      attachToTypes: Object.values(ACTOR_TYPES),
      attachPredicate: 'http://activitypods.org/ns/core#contacts',
      ordered: false,
      dereferenceItems: false
    });

    await this.broker.call('activitypub.registry.register', {
      path: '/contact-requests',
      attachToTypes: Object.values(ACTOR_TYPES),
      attachPredicate: 'http://activitypods.org/ns/core#contactRequests',
      ordered: false,
      dereferenceItems: true
    });

    await this.broker.call('activitypub.registry.register', {
      path: '/rejected-contacts',
      attachToTypes: Object.values(ACTOR_TYPES),
      attachPredicate: 'http://activitypods.org/ns/core#rejectedContacts',
      ordered: false,
      dereferenceItems: false
    });
  },
  methods: {
    async notifyContactOffer(ctx, senderUri, recipientUri, message) {
      const senderProfile = await ctx.call('activitypub.actor.getProfile', { actorUri: senderUri, webId: 'system' });

      await ctx.call('notification.notifyUser', {
        to: recipientUri,
        key: 'contact-offer',
        payload: {
          title: `${senderProfile['vcard:given-name']} souhaiterait se connecter avec vous`,
          body: message,
          actions: [{
            name: 'Mon réseau',
            link: '/Profile',
          }]
        }
      });
    },
    async notifyAcceptContactOffer(ctx, senderUri, recipientUri) {
      const senderProfile = await ctx.call('activitypub.actor.getProfile', { actorUri: senderUri, webId: 'system' });

      await ctx.call('notification.notifyUser', {
        to: recipientUri,
        key: 'contact-offer-accept',
        payload: {
          title: `${senderProfile['vcard:given-name']} fait maintenant partie de votre réseau`,
          message: `${senderProfile['vcard:given-name']} a accepté votre demande de mise en relation. Vous pouvez maintenant l'inviter aux événements que vous organisez.`,
          actions: [{
            name: 'Mon réseau',
            link: '/Profile',
          }]
        }
      });
    }
  },
  activities: {
    contactRequest: {
      match: CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        // Add the user to the contacts WebACL group so he can see my profile
        for (let targetUri of defaultToArray(activity.target)) {
          await ctx.call('webacl.group.addMember', {
            groupSlug: new URL(emitterUri).pathname + '/contacts',
            memberUri: targetUri,
            webId: emitterUri,
          });
        }
      },
      async onReceive(ctx, activity, recipients) {
        for (let recipientUri of recipients) {
          const recipient = await ctx.call('activitypub.actor.get', { actorUri: recipientUri });

          // If the request was already rejected, reject it again
          if (
            await ctx.call('activitypub.collection.includes', {
              collectionUri: recipient['apods:rejectedContacts'],
              itemUri: activity.actor,
            })
          ) {
            await ctx.call('activitypub.outbox.post', {
              collectionUri: recipient.outbox,
              type: ACTIVITY_TYPES.REJECT,
              actor: recipient.id,
              object: activity.id,
              to: activity.actor,
            });
            continue;
          }

          // Check that a request by the same actor is not already waiting (if so, ignore it)
          const collection = await ctx.call('activitypub.collection.get', {
            collectionUri: recipient['apods:contactRequests'],
            webId: recipientUri,
          });
          if (collection && collection.items.length > 0 && collection.items.find((a) => a.actor === activity.actor)) {
            continue;
          }

          await ctx.call('activitypub.collection.attach', {
            collectionUri: recipient['apods:contactRequests'],
            item: activity,
          });

          await this.notifyContactOffer(ctx, activity.actor, recipientUri, activity.content);
        }
      },
    },
    acceptContactRequest: {
      match: ACCEPT_CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: emitterUri });

        // 1. Add the other actor to the contacts WebACL group so he can see my profile
        await ctx.call('webacl.group.addMember', {
          groupSlug: new URL(emitterUri).pathname + '/contacts',
          memberUri: activity.to,
          webId: emitterUri,
        });

        // 2. Cache the other actor's profile
        await ctx.call('activitypub.object.cacheRemote', {
          objectUri: activity.object.object.object,
          actorUri: activity.actor,
        });

        // 3. Add the other actor to my contacts list
        await ctx.call('activitypub.collection.attach', {
          collectionUri: emitter['apods:contacts'],
          item: activity.object.actor,
        });

        // 4. Remove the activity from my contact requests
        await ctx.call('activitypub.collection.detach', {
          collectionUri: emitter['apods:contactRequests'],
          item: activity.object.id,
        });
      },
      async onReceive(ctx, activity, recipients) {
        for (let recipientUri of recipients) {
          const emitter = await ctx.call('activitypub.actor.get', { actorUri: activity.actor });
          const recipient = await ctx.call('activitypub.actor.get', { actorUri: recipientUri });

          // Cache the other actor's profile (it should be visible now)
          await ctx.call('activitypub.object.cacheRemote', {
            objectUri: emitter.url,
            actorUri: activity.to,
          });

          // Add the other actor to my contacts list
          await ctx.call('activitypub.collection.attach', {
            collectionUri: recipient['apods:contacts'],
            item: emitter.id,
          });

          await this.notifyAcceptContactOffer(ctx, activity.actor, recipientUri);
        }
      },
    },
    ignoreContactRequest: {
      match: IGNORE_CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: emitterUri });

        // Remove the activity from my contact requests
        await ctx.call('activitypub.collection.detach', {
          collectionUri: emitter['apods:contactRequests'],
          item: activity.object.id,
        });
      },
      async onReceive(ctx, activity, recipients) {
        for (let recipientUri of recipients) {
          // Remove the user from the contacts WebACL group so he can't see my profile anymore
          await ctx.call('webacl.group.removeMember', {
            groupSlug: new URL(recipientUri).pathname + '/contacts',
            memberUri: activity.actor,
            webId: recipientUri,
          });
        }
      },
    },
    rejectContactRequest: {
      match: REJECT_CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: emitterUri });

        // Add the actor to my rejected contacts list
        await ctx.call('activitypub.collection.attach', {
          collectionUri: emitter['apods:rejectedContacts'],
          item: activity.object.actor,
        });

        // Remove the activity from my contact requests
        await ctx.call('activitypub.collection.detach', {
          collectionUri: emitter['apods:contactRequests'],
          item: activity.object.id,
        });
      },
      async onReceive(ctx, activity, recipients) {
        for (let recipientUri of recipients) {
          // Remove the emitter from the contacts WebACL group so he can't see the recipient's profile anymore
          await ctx.call('webacl.group.removeMember', {
            groupSlug: new URL(recipientUri).pathname + '/contacts',
            memberUri: activity.actor,
            webId: recipientUri,
          });
        }
      },
    },
  },
};

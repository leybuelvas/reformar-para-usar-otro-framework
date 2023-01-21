module.exports.models = {

  migrate: 'alter',

  attributes: {
    createdAt: { type: 'number', autoCreatedAt: true, },
    updatedAt: { type: 'number', autoUpdatedAt: true, },
    id: { type: 'number', autoIncrement: true, },
  },

  dataEncryptionKeys: {
    default: 'Yeux1k7WvBWN0BfiC92QbXvNUxGy6Ptay2t7wgbyNjk='
  },

  cascadeOnDestroy: true


};

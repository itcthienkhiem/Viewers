Meteor.publish('hangingprotocols', function() {
    // TODO: filter by availableTo user
    return HangingProtocols.find();
});

Meteor.startup(function() {
    //HangingProtocols.remove({});
    if (HangingProtocols.find().count() === 0) {
        console.log('Inserting default protocols');
        HangingProtocols.insert(HP.defaultProtocol);
        HangingProtocols.insert(HP.testProtocol);
    }
});

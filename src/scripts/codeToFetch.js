const Utils = require('./Utils')
module.exports = {

    ApexClass: {
        names: [
            
        ]
    },
    AuraComponent: {
        names: [
            
        ],
        defTypes: ["COMPONENT", "CONTROLLER", "HELPER", "STYLE", "EVENT"],
    },

    LWC : {
        names: [
            
        ],
        fileNames : [

        ],
        ignoreMeta : true
    },

    VFPage : {
        names: [

        ]
    },

    VFComponent : {
        names: [
            
        ]
    },

    CustomLabels : {
        names : [
            
        ]
    },

    //supports custom objects and custom metadata
    Objects : {
        names : [
            
        ]
    },

    //supports custom objects and custom metadata
    ObjectRecords : {

        //& object mode below
        names : [
            // 'Account'
        ],
        days : 10,
        limit : 15,

        //& query mode below
        query : {
            // 'product2' : `select Id, Name from product2 where name = 'ABC' and Some_Field__c = 'Some Value' `,

            // <ObjectName> : <soql query>
        }
    },

    FieldSets : {
        names : [

        ]
        //Name Format to specify = ObjectName.FieldSetName
    },

    StaticResource : {
        names : [

        ]
    },

    EmailTemplate : {
        names : [
            
        ]
    },

    CustomMetadataRecords : {
        names : [

        ]
    },

    OrgNames: [ /* 'org1', 'org2' */ ],

    getCreds: function (orgName) {
        return Utils.getOrg(orgName);
    }
};
/*## DefTypes ##
    'APPLICATION' 'COMPONENT' 'CONTROLLER' 'DESIGN' 'DOCUMENTATION' 'EVENT' 'HELPER' 'INTERFACE' 'MODEL' 'MODULE' 'PROVIDER' 
    'RENDERER' 'STYLE' 'SVG' 'TESTSUITE' 'TOKENS'
*/
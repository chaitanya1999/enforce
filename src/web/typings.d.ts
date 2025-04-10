interface Window {
    customIpc: any;
    require: any;
    jsforce: any;
    desktopMode: any;
}

interface MyRequire {
    getIpcRenderer: Function
}

interface SelectOption {
    label: string,
    value: string,
    value1? : string;
    focused? : boolean;
}

interface EntityList {
    apex : Array<string>;
    aura : Array<string>;
    lwc : Array<string>;
}

// interface EnForceResponse {
//     isSuccess: boolean;
//     errors: any[] = [];
//     data: any;
// }

interface JQuery {
    typeahead(...args): void;
}

// class EnForce {
    
// }

// declare module jsforce {
    
// }

// declare module 'lodash/core';
declare module 'mime-type';
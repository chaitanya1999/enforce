import { CodeEntity } from "./AppConstants";
import { CodeTab } from "./CodeTab";
import { NormalizedCodeEntity } from "./enforce-utils";

export interface EditorSession {
    selectedOrg : string;
    // selectedOrg2 : string; - LATER
    selectedEntityType : string;
    openTabs : CodeTab[];
    activeTabModelId: string | null;
    // orgCredsList?: { orgName: string, icon: string, orgId: string }[]; - LATER
}
/**
 * Editor session algorithm:
 * 1. When a tab is opened, save session.
 * 2. When a tab is closed, save session.
 * 3. When a tab is switched, save session.
 * 4. When a tab is pinned, save session.
 * 5. When a tab is unpinned, save session.
 * 6. When a tab is hidden, save session.
 * 7. When a tab is unhidden, save session.
 * 8. When the browser is closed, save session. (unload event)
 * 9. For all above scenario, we can set an interval to save the session every 60 seconds if there are any changes.
 * 10. Quick DIFF mode and Bulk Load package XML to be handled carefully due to rapid changes.
 * 11. MVP1 : Provide a command to the user to save the session manually.
 * 
 * 4. When the application is loaded, read the session from local storage and prompt the user to restore the session.
 * 5. If the user chooses to restore the session, open all the tabs in the openTabs array using loadEntity and loadEntityBulk methods.
 * 6. Data which will persist in the session:
 *   - selectedOrg: The org name of the currently selected org.
 *   - selectedEntityType: The entity type of the currently selected entity.
 *   - openTabs: The list of open tabs. Upon restoring, tab objects will be regenerated, based on following properties from local storage
 *     - tabValue: The entity name used to fetch it
 *     - entityType: The entity type used to fetch it
 *     - orgName: The org name used to fetch it
 *     rest of the properties will be regenerated based on the entity fetched.
 *     Initially only Code Editor tabs restoration can be implemented before DIFF tabs.
 * 7. DIFF tabs will be regenerated based on the modelId of the original tab. A map will be required that maps old model ID to new model ID and then 
 *     update the related DIFF properties accordingly.
 * 8. Index needs to be restored as the old session. Tabs need to be marked hidden/pinned based on the old session.
 * 9. Org validation required before the session is restored, as org may be deleted, or creds modified in between
 * 10. Temporary tabs will not be saved in the session and to be closed when session is restored.
 */
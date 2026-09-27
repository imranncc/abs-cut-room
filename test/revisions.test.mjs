import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationNotice} from '../public/revision-model.js';
test('publication notices do not mutate reviewer messages and compare latest edits',()=>{
 const messages=[{text:'Keep this',at:'2026-09-25T12:00:00Z'}];
 const before=JSON.stringify(messages),updatedAt='2026-09-27T12:00:00Z';
 assert.equal(publicationNotice({updatedAt,messages}).sinceFeedback,true);
 assert.equal(JSON.stringify(messages),before);
 assert.equal(publicationNotice({updatedAt,messages,draftUpdatedAt:'2026-09-27T13:00:00Z'}).sinceFeedback,false);
 assert.equal(publicationNotice({updatedAt,messages:[{...messages[0],editedAt:'2026-09-28T00:00:00Z'}]}).sinceFeedback,false);
 assert.equal(publicationNotice({updatedAt,messages:[]}).sinceFeedback,false);
 assert.equal(publicationNotice({updatedAt:'invalid',messages}),null);
});

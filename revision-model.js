// Publication timestamps belong to application content, never to reviewers' messages.
export function publicationNotice({updatedAt,messages=[],draftUpdatedAt}) {
 const published=Date.parse(updatedAt);
 if(!Number.isFinite(published))return null;
 const times=[...messages.map(m=>Date.parse(m.editedAt||m.at)),Date.parse(draftUpdatedAt)].filter(Number.isFinite);
 return {sinceFeedback:times.length>0&&Math.max(...times)<published};
}

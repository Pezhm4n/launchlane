import {createElement} from 'react';
const result=createElement('output',null,'Vite component total: '+(17*3+11*2));document.querySelector('#status').textContent=result.props.children;document.querySelector('#next').addEventListener('click',()=>{history.pushState({},'', '/orders');document.querySelector('#status').textContent='Orders total: 73';});

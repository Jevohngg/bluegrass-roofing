// config/contracts.js

const contracts = {
    aob: [
      { name: 'clientName',               label: 'Client Name(s)',              type: 'text'          },
      { name: 'propertyAddress',          label: 'Property Address',            type: 'text'          },
      { name: 'phoneNumber',              label: 'Phone Number',                type: 'text'          },
      { name: 'emailAddress',             label: 'Email Address',               type: 'text'          },
      { name: 'homeowner1PrintedName',    label: 'Homeowner 1 Printed Name',    type: 'text'          },
      { name: 'homeowner1Date',           label: 'Homeowner 1 Date',            type: 'date'          },
      { name: 'signatureHomeowner1',      label: 'Homeowner 1 Signature',       type: 'signature'     },
      { name: 'homeowner2PrintedName',    label: 'Homeowner 2 Printed Name',    type: 'text'          },
      { name: 'homeowner2Date',           label: 'Homeowner 2 Date',            type: 'date'          },
      { name: 'signatureHomeowner2',      label: 'Homeowner 2 Signature',       type: 'signature'     },
      { name: 'contractorRepPrintedName', label: 'Contractor Rep Printed Name', type: 'text'          },
      { name: 'contractorRepDate',        label: 'Contractor Rep Date',         type: 'date'          },
      { name: 'signatureContractorRep',   label: 'Contractor Rep Signature',    type: 'signature'     },
      { name: 'contractorRepTitle',       label: 'Contractor Rep Title',        type: 'text'          },
   
    ],
  
    aci: [
      { name: 'clientName',               label: 'Client Name(s)',             type: 'text'          },
      { name: 'propertyAddress',          label: 'Property Address',           type: 'text'          },
      { name: 'insuranceCompany',         label: 'Insurance Company Name',      type: 'text'          },
      { name: 'claimNumber',              label: 'Claim Number',               type: 'text'          },
  
      { name: 'homeowner1PrintedName',    label: 'Homeowner 1 Printed Name',   type: 'text'          },
      { name: 'homeowner1Date',           label: 'Homeowner 1 Date',           type: 'date'          },
      { name: 'signatureHomeowner1',      label: 'Homeowner 1 Signature',      type: 'signature'     },
  
      { name: 'homeowner2PrintedName',    label: 'Homeowner 2 Printed Name',   type: 'text'          },
      { name: 'homeowner2Date',           label: 'Homeowner 2 Date',           type: 'date'          },
      { name: 'signatureHomeowner2',      label: 'Homeowner 2 Signature',      type: 'signature'     },
  
      { name: 'contractorRepPrintedName', label: 'Contractor Rep Printed Name',type: 'text'          },
      { name: 'contractorRepDate',        label: 'Contractor Rep Date',        type: 'date'          },
      { name: 'signatureContractorRep',   label: 'Contractor Rep Signature',   type: 'signature'     },
  
      { name: 'contractorRepTitle',       label: 'Contractor Rep Title',       type: 'text'          },

    ],
  
    loi: [
      { name: 'clientName',            label: 'Client Name(s)',            type: 'text'          },
      { name: 'propertyAddress',       label: 'Property Address',          type: 'text'          },
      { name: 'phoneNumber',           label: 'Phone Number',              type: 'text'          },
      { name: 'emailAddress',          label: 'Email Address',             type: 'text'          },
  
      { name: 'propertyAddressAgain',  label: 'Property Address (again)',  type: 'text'          },
  
      { name: 'homeowner1PrintedName', label: 'Homeowner 1 Printed Name',  type: 'text'          },
      { name: 'signatureHomeowner1',   label: 'Homeowner 1 Signature',     type: 'signature'     },
      { name: 'homeowner1Date',        label: 'Homeowner 1 Date',          type: 'date'          },
  
      { name: 'homeowner2PrintedName', label: 'Homeowner 2 Printed Name',  type: 'text'          },
      { name: 'signatureHomeowner2',   label: 'Homeowner 2 Signature',     type: 'signature'     },
      { name: 'homeowner2Date',        label: 'Homeowner 2 Date',          type: 'date'          },
  
      { name: 'contractorRepPrintedName', label: 'Contractor Rep Printed Name', type: 'text'          },
      { name: 'signatureContractorRep',   label: 'Contractor Rep Signature',    type: 'signature'     },
      { name: 'contractorRepDate',        label: 'Contractor Rep Date',         type: 'date'          },
  
      { name: 'contractorRepTitle',    label: 'Contractor Rep Title',      type: 'text'          },
   
    ],
  
    gsa: [
      { name: 'clientNames',               label: 'Client Name(s)',             type: 'text'          },
      { name: 'fullPropertyAddress',       label: 'Property Location',          type: 'text'          },
      { name: 'effectiveDate',             label: 'Effective Date',             type: 'text'          },
  
      { name: 'clientNameAgain',           label: 'Prepared For: Full Name',    type: 'text'          },
      { name: 'clientAddress',             label: 'Prepared For: Address',      type: 'text'          },
      { name: 'clientPhone',               label: 'Prepared For: Phone Number', type: 'text'          },
      { name: 'clientEmail',               label: 'Prepared For: Email',        type: 'email'         },
  
      { name: 'agreementDay',              label: 'Agreement Day',              type: 'number'        },
      { name: 'agreementMonth',            label: 'Agreement Month',            type: 'text'          },
  
      { name: 'clientFullName',            label: 'Client Full Name',           type: 'text'          },
      { name: 'clientResidingAddress',     label: 'Client Residing Address',    type: 'text'          },
      { name: 'serviceAddress',            label: 'Service Address',            type: 'text'          },
  
      { name: 'propertyAddress2',          label: 'Property Address',           type: 'text'          },
      { name: 'projectTypes',              label: 'Type of Project',            type: 'checkboxArray' },
      { name: 'projectTypeOther',          label: 'Other Project Type',         type: 'text'          },
  
      { name: 'homeownerPrintedName',      label: 'Homeowner Printed Name',     type: 'text'          },
      { name: 'signatureHomeowner',        label: 'Homeowner Signature',        type: 'signature'     },
      { name: 'homeownerDate',             label: 'Homeowner Date',             type: 'date'          },
  
      { name: 'signatureContractor',       label: 'Contractor Signature',       type: 'signature'     },
      { name: 'contractorPrintedName',     label: 'Contractor Printed Name',    type: 'text'          },
      { name: 'contractorTitle',           label: 'Contractor Title',           type: 'text'          },
      { name: 'contractorDate',            label: 'Contractor Date',            type: 'date'          }
    ],
  
    coc: [
      { name: 'claimNumber',             label: 'Claim #',                        type: 'text'      },
      { name: 'clientName',              label: 'Client Name',                   type: 'text'      },
      { name: 'propertyAddressLine1',    label: 'Property Address (Line 1)',     type: 'text'      },
      { name: 'propertyAddressLine2',    label: 'Property Address (Line 2)',     type: 'text'      },
  
      { name: 'clientSignatureName',     label: 'Client Signature Name',         type: 'text'      },
      { name: 'clientSignature',         label: 'Client Signature',     type: 'signature' },
      { name: 'clientSignatureDate',     label: 'Client Signature Date',         type: 'date'      },
  
      { name: 'contractorName',          label: 'Contractor Name',               type: 'text'      },
      { name: 'contractorSignature',     label: 'Contractor Signature',  type: 'signature' },
      { name: 'contractorSignatureDate', label: 'Contractor Signature Date',      type: 'date'      }
    ]
  };
  
  module.exports = contracts;
  
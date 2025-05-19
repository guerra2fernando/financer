/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/investments/InvestmentPortfolio.tsx
// (Assuming this is a distinct component, not the one named InvestmentPortfolioAccordion.tsx)
'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { Investment, CurrencyContextProps, InvestmentTransaction } from '@/types'; // Added CurrencyContextProps & InvestmentTransaction
import InvestmentForm from '@/components/forms/InvestmentForm';
import InvestmentTransactionForm from '@/components/forms/InvestmentTransactionForm';
import InvestmentTransactionList from './InvestmentTransactionList'; // Assuming this path
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { PlusCircle, Edit, Trash2, ReceiptText, Loader2, TrendingUp, Info } from 'lucide-react'; // Added Loader2, TrendingUp, Info
import { deleteInvestment, getInvestmentsByUserId } from '@/services/investmentService';
import { format as formatDateFnsLocale, parseISO } from 'date-fns'; // Renamed format
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils'; // Import formatCurrency
import { Badge } from '@/components/ui/badge'; // Import Badge
import { BASE_REPORTING_CURRENCY, CurrencyCode } from '@/lib/constants'; // For formatting

interface InvestmentPortfolioProps {
  // If this component manages its own context (e.g. for a dashboard widget not full page)
  // initialInvestments might be fetched here or passed.
  // For simplicity, let's assume it receives them and currencyContext like the accordion.
  investments: Investment[]; // Changed from initialInvestments to reflect current state
  userId: string;
  currencyContext: CurrencyContextProps;
  onRefreshInvestments: () => Promise<void>; // Callback to refresh investments in parent
  // Callbacks for parent to handle dialogs if this component doesn't manage them
  // For this example, let's assume it manages its own dialogs like the original.
  // But if it's a child of InvestmentPageClientContent, these might be passed down.
  onEditInvestment: (investment: Investment) => void;
  onAddTransaction: (investment: Investment) => void;
  onViewTransactions?: (investment: Investment) => void; // Optional for chart linking
  isLoading?: boolean; // Optional loading state from parent
}

export default function InvestmentPortfolio({
  investments: parentInvestments, // Renamed to avoid conflict with local state if any
  userId,
  currencyContext,
  onRefreshInvestments,
  onEditInvestment, // Use this from props
  onAddTransaction, // Use this from props
  onViewTransactions,
  isLoading: parentIsLoading,
}: InvestmentPortfolioProps) {
  const supabase = createClient();
  
  // This component might not need its own 'investments' state if parent manages it.
  // If it does, then it needs to sync with parentInvestments.
  // For this refactor, let's assume it *displays* parentInvestments.
  // const [investments, setInvestments] = useState<Investment[]>(parentInvestments);
  // useEffect(() => {
  //   setInvestments(parentInvestments);
  // }, [parentInvestments]);


  // If this component were to manage its own dialogs:
  const [showInvestmentFormDialog, setShowInvestmentFormDialog] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [showTransactionFormDialog, setShowTransactionFormDialog] = useState(false);
  const [selectedInvestmentForTx, setSelectedInvestmentForTx] = useState<Investment | null>(null);
  
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [openAccordionItem, setOpenAccordionItem] = useState<string | undefined>(undefined);
  
  const { baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  // Handler functions if this component manages dialogs:
  const openAddInvestmentFormLocal = () => {
    setEditingInvestment(null);
    setShowInvestmentFormDialog(true);
  };
  const openEditInvestmentFormLocal = (investment: Investment) => {
    setEditingInvestment(investment);
    setShowInvestmentFormDialog(true);
  };
  const openAddTransactionFormLocal = (investment: Investment) => {
    setSelectedInvestmentForTx(investment);
    setShowTransactionFormDialog(true);
  };
  const handleInvestmentFormSuccessLocal = () => {
    setShowInvestmentFormDialog(false);
    setEditingInvestment(null);
    onRefreshInvestments(); // Call parent refresh
  };
  const handleTransactionFormSuccessLocal = () => {
    setShowTransactionFormDialog(false);
    setSelectedInvestmentForTx(null);
    onRefreshInvestments(); // Call parent refresh
  };


  const handleDeleteInvestment = async (investmentId: string) => {
    if (!confirm('Are you sure you want to delete this investment and all its transactions?')) return;
    setIsDeleting(investmentId);
    const { error } = await deleteInvestment(supabase, investmentId);
    setIsDeleting(null);
    if (error) {
      toast.error(`Failed to delete investment: ${error.message}`);
    } else {
      toast.success('Investment deleted successfully!');
      onRefreshInvestments();
       if (openAccordionItem === investmentId) {
        setOpenAccordionItem(undefined);
      }
    }
  };
  
  const handleAccordionChange = (value: string | undefined) => {
    setOpenAccordionItem(value);
    if (value && onViewTransactions) {
        const selected = parentInvestments.find(inv => inv.id === value);
        if (selected) {
            onViewTransactions(selected);
        }
    }
  };

  const formatVal = (value: number | null | undefined, sourceCurrency: CurrencyCode) => {
    if (value === null || value === undefined) return '-';
    return formatCurrency(value, sourceCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates);
  };
  
  const formatValNative = (value: number | null | undefined, nativeCurrency: CurrencyCode) => {
    if (value === null || value === undefined) return '-';
    return formatCurrency(value, nativeCurrency, nativeCurrency, allCurrenciesData, currentExchangeRates);
  }

  const isLoading = parentIsLoading === undefined ? false : parentIsLoading;


  if (isLoading && parentInvestments.length === 0) {
    return (
      <div className="py-8 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading investments...</p>
      </div>
    );
  }

  if (!isLoading && parentInvestments.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
        <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
        <h3 className="text-xl font-semibold">No Investments Yet</h3>
        <p className="text-muted-foreground">Add an investment to start tracking your portfolio.</p>
         <Button onClick={openAddInvestmentFormLocal} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Investment
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Button to add investment might be in parent or here if this is a standalone widget */}
      {/* <div className="flex justify-end">
        <Button onClick={openAddInvestmentFormLocal}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Investment
        </Button>
      </div> */}

      <Dialog open={showInvestmentFormDialog} onOpenChange={setShowInvestmentFormDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInvestment ? 'Edit Investment' : 'Add New Investment'}</DialogTitle>
             <DialogDescription>
              {editingInvestment ? `Update details for ${editingInvestment.name}. Investment Currency: ${editingInvestment.currency_code}` : 'Define a new investment. Choose its native currency.'}
            </DialogDescription>
          </DialogHeader>
          <InvestmentForm
            userId={userId}
            initialData={editingInvestment}
            onSubmitSuccess={handleInvestmentFormSuccessLocal}
            onCancel={() => setShowInvestmentFormDialog(false)}
            currencyContext={currencyContext}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showTransactionFormDialog} onOpenChange={setShowTransactionFormDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction for {selectedInvestmentForTx?.name}</DialogTitle>
            <DialogDescription>
              Investment currency: {selectedInvestmentForTx?.currency_code}. Transaction will update its quantity and value.
            </DialogDescription>
          </DialogHeader>
          {selectedInvestmentForTx && (
             <InvestmentTransactionForm
              userId={userId}
              investmentId={selectedInvestmentForTx.id}
              investmentCurrency={selectedInvestmentForTx.currency_code}
              onSubmitSuccess={handleTransactionFormSuccessLocal}
              onCancel={() => setShowTransactionFormDialog(false)}
              currencyContext={currencyContext}
            />
          )}
        </DialogContent>
      </Dialog>

      <Accordion 
          type="single" 
          collapsible 
          className="w-full space-y-2"
          value={openAccordionItem}
          onValueChange={handleAccordionChange}
      >
        {parentInvestments.map((investment) => (
          <AccordionItem value={investment.id} key={investment.id} className="border rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="hover:bg-muted/50 dark:hover:bg-muted/20 px-4 py-3 text-sm data-[state=open]:bg-muted/50 data-[state=open]:dark:bg-muted/30">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-1 items-center text-left">
                <div className="font-semibold col-span-2 sm:col-span-1 truncate" title={investment.name}>
                  {investment.name}
                </div>
                <Badge variant="outline" className="w-fit text-xs truncate" title={investment.type}>{investment.type}</Badge>
                <div className="text-xs md:text-sm">
                  Qty: <span className="font-medium">{investment.quantity?.toLocaleString() || '-'}</span>
                </div>
                <div className="text-xs md:text-sm">
                  Value ({userPreferredCurrency}): <span className="font-medium">{formatVal(investment.total_current_value_reporting_currency, baseReportingCurrency)}</span>
                </div>
                <div className="text-xs md:text-sm hidden md:block">
                  Cost ({userPreferredCurrency}): <span className="font-medium">{formatVal(investment.total_initial_cost_reporting_currency, baseReportingCurrency)}</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-2 space-y-3 bg-background data-[state=open]:border-t">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-3">
                <div><span className="text-muted-foreground">Native Currency: </span><span className="font-medium">{investment.currency_code}</span></div>
<div><span className="text-muted-foreground">Acct: </span><span className="font-medium truncate" title={investment.accounts?.[0]?.name || ''}>{(investment.accounts?.[0]?.name || (investment.account_id ? 'N/A' : '-'))}</span></div>
                <div><span className="text-muted-foreground">Start Date: </span><span className="font-medium">{investment.start_date ? formatDateFnsLocale(parseISO(investment.start_date), 'MMM d, yyyy') : '-'}</span></div>
                
                <div className="font-semibold col-span-full mt-1 border-b pb-1">Native Values</div>
                <div><span className="text-muted-foreground">Purchase Price/Unit: </span><span className="font-medium">{formatValNative(investment.purchase_price_per_unit_native, investment.currency_code)}</span></div>
                <div><span className="text-muted-foreground">Current Price/Unit: </span><span className="font-medium">{formatValNative(investment.current_price_per_unit_native, investment.currency_code)}</span></div>
                <div><span className="text-muted-foreground">Total Initial Cost: </span><span className="font-medium">{formatValNative(investment.total_initial_cost_native, investment.currency_code)}</span></div>
                <div><span className="text-muted-foreground">Total Current Value: </span><span className="font-medium">{formatValNative(investment.total_current_value_native, investment.currency_code)}</span></div>
                <div><span className="text-muted-foreground">Monthly Goal: </span><span className="font-medium">{formatValNative(investment.monthly_goal_native, investment.currency_code)}</span></div>

                <div className="font-semibold col-span-full mt-1 border-b pb-1">{baseReportingCurrency} Values (for reporting)</div>
                <div><span className="text-muted-foreground">Purchase Price/Unit: </span><span className="font-medium">{formatVal(investment.purchase_price_per_unit_reporting_currency, baseReportingCurrency)}</span></div>
                <div><span className="text-muted-foreground">Current Price/Unit: </span><span className="font-medium">{formatVal(investment.current_price_per_unit_reporting_currency, baseReportingCurrency)}</span></div>
                <div><span className="text-muted-foreground">Total Initial Cost: </span><span className="font-medium">{formatVal(investment.total_initial_cost_reporting_currency, baseReportingCurrency)}</span></div>
                <div><span className="text-muted-foreground">Total Current Value: </span><span className="font-medium">{formatVal(investment.total_current_value_reporting_currency, baseReportingCurrency)}</span></div>
                <div><span className="text-muted-foreground">Monthly Goal: </span><span className="font-medium">{formatVal(investment.monthly_goal_reporting_currency, baseReportingCurrency)}</span></div>

                {investment.notes && (<div className="col-span-full text-xs pt-1 border-t mt-1"><span className="text-muted-foreground">Notes: </span>{investment.notes}</div>)}
              </div>
              <div className="flex gap-2 justify-end items-center border-t pt-3">
                 {/* Use prop functions for edit/add if this is a child controlled by parent dialogs */}
                <Button variant="ghost" size="sm" onClick={() => handleAccordionChange(openAccordionItem === investment.id ? undefined : investment.id)}>
                    <TrendingUp className="mr-1.5 h-4 w-4" /> View Chart / Transactions
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAddTransaction(investment)}><ReceiptText className="mr-1.5 h-4 w-4" /> Log Transaction</Button>
                <Button variant="outline" size="sm" onClick={() => onEditInvestment(investment)}><Edit className="mr-1.5 h-4 w-4" /> Edit Info</Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteInvestment(investment.id)} disabled={isDeleting === investment.id} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10">
                  {isDeleting === investment.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : <Trash2 className="mr-1.5 h-4 w-4" />} Delete
                </Button>
              </div>
              {openAccordionItem === investment.id && (
                  <InvestmentTransactionList 
                      investmentId={investment.id} 
                      userId={userId} 
                      currencyContext={currencyContext}
                  />
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

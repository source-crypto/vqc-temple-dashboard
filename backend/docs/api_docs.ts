import { api } from "encore.dev/api";

interface OpenAPIResponse {}

// OpenAPI/Swagger documentation endpoint
export const getOpenAPISpec = api<void, OpenAPIResponse>(
  { expose: true, method: "GET", path: "/api/docs/openapi.json" },
  async () => {
    return {
      openapi: "3.0.3",
      info: {
        title: "VQC Temple API",
        description: "Comprehensive API for VQC Temple blockchain and quantum verification system",
        version: "1.0.0",
        contact: {
          name: "VQC Temple Team",
          email: "support@vqctemple.com"
        },
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT"
        }
      },
      servers: [
        {
          url: "https://api.vqctemple.com",
          description: "Production server"
        },
        {
          url: "http://localhost:4000",
          description: "Development server"
        }
      ],
      paths: {
        "/health": {
          get: {
            tags: ["System"],
            summary: "Get system health status",
            description: "Returns comprehensive system health including database, API, and memory metrics",
            responses: {
              "200": {
                description: "System health information",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/SystemHealth"
                    }
                  }
                }
              }
            }
          }
        },
        "/blockchain/explorer/blocks": {
          get: {
            tags: ["Blockchain Explorer"],
            summary: "Get latest blocks",
            description: "Retrieve the most recent blocks from the VQC blockchain",
            responses: {
              "200": {
                description: "List of latest blocks",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        blocks: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/Block"
                          }
                        },
                        total: {
                          type: "integer"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/blockchain/explorer/transactions": {
          get: {
            tags: ["Blockchain Explorer"],
            summary: "Get latest transactions",
            description: "Retrieve the most recent transactions from the VQC blockchain",
            responses: {
              "200": {
                description: "List of latest transactions",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        transactions: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/Transaction"
                          }
                        },
                        total: {
                          type: "integer"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/blockchain/explorer/search/advanced": {
          post: {
            tags: ["Blockchain Explorer"],
            summary: "Advanced blockchain search",
            description: "Perform advanced search with filtering, sorting, and pagination",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AdvancedSearchRequest"
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Search results",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/AdvancedSearchResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/blockchain/amm/pools": {
          get: {
            tags: ["AMM"],
            summary: "Get liquidity pools",
            description: "Retrieve all available liquidity pools for token swapping",
            responses: {
              "200": {
                description: "List of liquidity pools",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        pools: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/LiquidityPool"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/blockchain/amm/quote": {
          get: {
            tags: ["AMM"],
            summary: "Get swap quote",
            description: "Get a quote for swapping tokens including price impact and fees",
            parameters: [
              {
                name: "tokenIn",
                in: "query",
                required: true,
                schema: {
                  type: "string"
                },
                description: "Input token symbol"
              },
              {
                name: "tokenOut",
                in: "query",
                required: true,
                schema: {
                  type: "string"
                },
                description: "Output token symbol"
              },
              {
                name: "amountIn",
                in: "query",
                required: true,
                schema: {
                  type: "string"
                },
                description: "Input amount in wei"
              }
            ],
            responses: {
              "200": {
                description: "Swap quote",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/SwapQuote"
                    }
                  }
                }
              }
            }
          }
        },
        "/blockchain/amm/swap": {
          post: {
            tags: ["AMM"],
            summary: "Execute token swap",
            description: "Execute a token swap through the AMM",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/SwapRequest"
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Swap execution result",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        amountOut: {
                          type: "string"
                        },
                        txHash: {
                          type: "string"
                        },
                        priceImpact: {
                          type: "number"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/temple/attestation": {
          get: {
            tags: ["Temple"],
            summary: "List attestation records",
            description: "Retrieve all TPM attestation records",
            responses: {
              "200": {
                description: "List of attestation records",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        records: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/AttestationRecord"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            tags: ["Temple"],
            summary: "Create attestation record",
            description: "Create a new TPM attestation record",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/CreateAttestationRequest"
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Created attestation record",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        record: {
                          $ref: "#/components/schemas/AttestationRecord"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/temple/vqc/metrics": {
          get: {
            tags: ["Temple"],
            summary: "Get VQC metrics",
            description: "Retrieve quantum cycle metrics and system health data",
            responses: {
              "200": {
                description: "VQC metrics data",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        metrics: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/VQCMetrics"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          SystemHealth: {
            type: "object",
            properties: {
              database: {
                type: "object",
                properties: {
                  isHealthy: { type: "boolean" },
                  connectionCount: { type: "integer" },
                  activeQueries: { type: "integer" },
                  avgResponseTime: { type: "number" },
                  uptime: { type: "number" }
                }
              },
              api: {
                type: "object",
                properties: {
                  isHealthy: { type: "boolean" },
                  avgResponseTime: { type: "number" },
                  errorRate: { type: "number" },
                  requestCount: { type: "integer" }
                }
              },
              memory: {
                type: "object",
                properties: {
                  used: { type: "number" },
                  total: { type: "number" },
                  percentage: { type: "number" }
                }
              },
              timestamp: { type: "string", format: "date-time" }
            }
          },
          Block: {
            type: "object",
            properties: {
              id: { type: "integer" },
              blockNumber: { type: "integer" },
              blockHash: { type: "string" },
              parentHash: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
              minerAddress: { type: "string" },
              difficulty: { type: "integer" },
              gasLimit: { type: "integer" },
              gasUsed: { type: "integer" },
              transactionCount: { type: "integer" },
              sizeBytes: { type: "integer" }
            }
          },
          Transaction: {
            type: "object",
            properties: {
              id: { type: "integer" },
              txHash: { type: "string" },
              blockNumber: { type: "integer" },
              fromAddress: { type: "string" },
              toAddress: { type: "string" },
              value: { type: "string" },
              gasPrice: { type: "integer" },
              gasLimit: { type: "integer" },
              gasUsed: { type: "integer" },
              status: { type: "integer" },
              timestamp: { type: "string", format: "date-time" }
            }
          },
          LiquidityPool: {
            type: "object",
            properties: {
              id: { type: "integer" },
              tokenA: { type: "string" },
              tokenB: { type: "string" },
              reserveA: { type: "string" },
              reserveB: { type: "string" },
              totalLiquidity: { type: "string" },
              feeRate: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
              lastUpdated: { type: "string", format: "date-time" }
            }
          },
          SwapQuote: {
            type: "object",
            properties: {
              inputAmount: { type: "string" },
              outputAmount: { type: "string" },
              priceImpact: { type: "number" },
              fee: { type: "string" },
              minimumOutput: { type: "string" },
              route: {
                type: "array",
                items: { type: "string" }
              }
            }
          },
          SwapRequest: {
            type: "object",
            required: ["userId", "tokenIn", "tokenOut", "amountIn", "minimumAmountOut"],
            properties: {
              userId: { type: "string" },
              tokenIn: { type: "string" },
              tokenOut: { type: "string" },
              amountIn: { type: "string" },
              minimumAmountOut: { type: "string" },
              slippageTolerance: { type: "number" }
            }
          },
          AdvancedSearchRequest: {
            type: "object",
            properties: {
              query: { type: "string" },
              filters: {
                type: "object",
                properties: {
                  transactionType: {
                    type: "string",
                    enum: ["all", "transfer", "contract_call", "contract_creation"]
                  },
                  dateRange: {
                    type: "object",
                    properties: {
                      from: { type: "string", format: "date-time" },
                      to: { type: "string", format: "date-time" }
                    }
                  },
                  valueRange: {
                    type: "object",
                    properties: {
                      min: { type: "string" },
                      max: { type: "string" }
                    }
                  },
                  addresses: {
                    type: "array",
                    items: { type: "string" }
                  },
                  status: {
                    type: "string",
                    enum: ["all", "success", "failed"]
                  }
                }
              },
              sort: {
                type: "object",
                properties: {
                  field: {
                    type: "string",
                    enum: ["timestamp", "value", "gas_used", "block_number"]
                  },
                  direction: {
                    type: "string",
                    enum: ["asc", "desc"]
                  }
                }
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer", minimum: 1 },
                  limit: { type: "integer", minimum: 1, maximum: 100 }
                }
              }
            }
          },
          AdvancedSearchResponse: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: { type: "object" }
              },
              total: { type: "integer" },
              page: { type: "integer" },
              totalPages: { type: "integer" },
              suggestions: {
                type: "array",
                items: { type: "string" }
              }
            }
          },
          AttestationRecord: {
            type: "object",
            properties: {
              id: { type: "integer" },
              timestamp: { type: "string", format: "date-time" },
              pcrValues: {
                type: "object",
                properties: {
                  pcr0: { type: "string" },
                  pcr1: { type: "string" },
                  pcr2: { type: "string" },
                  pcr3: { type: "string" },
                  pcr4: { type: "string" },
                  pcr5: { type: "string" },
                  pcr6: { type: "string" },
                  pcr7: { type: "string" }
                }
              },
              tmpQuote: { type: "string" },
              signature: { type: "string" },
              canonicalHash: { type: "string" },
              verificationStatus: { type: "string" },
              blockchainTxHash: { type: "string" }
            }
          },
          CreateAttestationRequest: {
            type: "object",
            required: ["pcrValues", "tmpQuote", "signature"],
            properties: {
              pcrValues: {
                type: "object",
                properties: {
                  pcr0: { type: "string" },
                  pcr1: { type: "string" },
                  pcr2: { type: "string" },
                  pcr3: { type: "string" },
                  pcr4: { type: "string" },
                  pcr5: { type: "string" },
                  pcr6: { type: "string" },
                  pcr7: { type: "string" }
                }
              },
              tmpQuote: { type: "string" },
              signature: { type: "string" }
            }
          },
          VQCMetrics: {
            type: "object",
            properties: {
              id: { type: "integer" },
              timestamp: { type: "string", format: "date-time" },
              cycleCount: { type: "integer" },
              entropyLevel: { type: "number" },
              systemHealth: { type: "number" },
              quantumCoherence: { type: "number" },
              temperature: { type: "number" },
              powerConsumption: { type: "number" }
            }
          }
        }
      },
      tags: [
        {
          name: "System",
          description: "System health and monitoring endpoints"
        },
        {
          name: "Blockchain Explorer",
          description: "Blockchain data exploration and search"
        },
        {
          name: "AMM",
          description: "Automated Market Maker for token swapping"
        },
        {
          name: "Temple",
          description: "VQC Temple quantum verification system"
        }
      ]
    } as OpenAPIResponse;
  }
);

interface SwaggerUIResponse {
  html: string;
}

// Swagger UI endpoint
export const getSwaggerUI = api<void, SwaggerUIResponse>(
  { expose: true, method: "GET", path: "/api/docs" },
  async () => {
    return {
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VQC Temple API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        requestInterceptor: function(request) {
          request.headers['Content-Type'] = 'application/json';
          return request;
        }
      });
    };
  </script>
</body>
</html>
    `
    };
  }
);

import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { FaEdit, FaPlus, FaCode, FaTrash, FaDownload } from 'react-icons/fa';
import { BiSelectMultiple } from "react-icons/bi";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Swal from 'sweetalert2';
import ImportFromSwagger from './ImportFromSwagger';

function App() {
    const [serviceName, setServiceName] = useState("");
    const [apiEndpoint, setApiEndpoint] = useState("");
    const [requestType, setRequestType] = useState("GET");
    const [headerKey, setHeaderKey] = useState("");
    const [headerValue, setHeaderValue] = useState("");
    const [headers, setHeaders] = useState([]);
    const [bulkHeaders, setBulkHeaders] = useState("");
    const [requestBody, setRequestBody] = useState("");
    const [responseBody, setResponseBody] = useState("");
    const [errorResponseBody, setErrorResponseBody] = useState("");
    const [responseCode, setResponseCode] = useState("200");
    const [generatedCode, setGeneratedCode] = useState("");
    const [stepDefinition, setStepDefinition] = useState("");
    const [featureFile, setFeatureFile] = useState("");

    // Track view mode for each JSON field
    const [viewMode, setViewMode] = useState({
        request: 'edit',
        response: 'edit',
        error: 'edit'
    });

    const addHeader = () => {
        if (headerKey.trim() && headerValue.trim()) {
            setHeaders([...headers, { key: headerKey.trim(), value: headerValue.trim() }]);
            setHeaderKey("");
            setHeaderValue("");
        }
    };

    const bulkAddHeaders = () => {
        if (bulkHeaders.trim()) {
            const newHeaders = bulkHeaders
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.includes(":"))
                .map((line) => {
                    const idx = line.indexOf(":");
                    return {
                        key: line.slice(0, idx).trim(),
                        value: line.slice(idx + 1).trim(),
                    };
                });
            setHeaders([...headers, ...newHeaders]);
            setBulkHeaders("");
        }
    };

    const clearAll = () => {
        setServiceName("");
        setApiEndpoint("");
        setRequestType("GET");
        setHeaderKey("");
        setHeaderValue("");
        setHeaders([]);
        setBulkHeaders("");
        setRequestBody("");
        setResponseBody("");
        setErrorResponseBody("");
        setResponseCode("200");
        setGeneratedCode("");
        setStepDefinition("");
        setFeatureFile("");
        setViewMode({
            request: 'edit',
            response: 'edit',
            error: 'edit'
        });
    };

    const formatJson = (jsonStr, setter, field) => {
        try {
            if (!jsonStr.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Oops...',
                    text: 'Please enter JSON to format',
                });
                return;
            }

            const parsed = JSON.parse(jsonStr); // ✅ Moved to top
            const pretty = JSON.stringify(parsed, null, 2);
            setter(pretty);

            if (field === 'request') {
                setParsedRequestBody(parsed);
                setSelectedRequestFields(getAllFieldPaths(parsed));
            }

            setViewMode({ ...viewMode, [field]: 'view' });

        } catch (e) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid JSON',
                text: `Please check your input.\nError: ${e.message}`,
            });
        }
    };


    const toggleField = (key) => {
        setSelectedRequestFields(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    // const selectAllFields = () => setSelectedRequestFields(Object.keys(parsedRequestBody));
    // const deselectAllFields = () => setSelectedRequestFields([]);

    const toggleEditMode = (field) => {
        setViewMode({ ...viewMode, [field]: 'edit' });
    };

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    const detectType = (value) => {
        if (Array.isArray(value)) {
            if (value.length === 0) return "List<Object>";
            return "List<" + detectType(value[0]) + ">";
        }
        if (value === null) return "Object";
        switch (typeof value) {
            case "number":
                return Number.isInteger(value) ? "int" : "double";
            case "boolean":
                return "boolean";
            case "object":
                return null;
            default:
                return "String";
        }
    };

    function generateClass(name, jsonObj, indent = '    ') {
        let classCode = `public class ${name} {\n`;
        let gettersSetters = '';
        let nestedClasses = '';

        for (const [key, value] of Object.entries(jsonObj)) {
            let type = detectType(value);

            if (type === null) {
                const nestedClassName = capitalize(key);
                const nestedCode = generateClass(nestedClassName, value, indent + '   ');
                type = nestedClassName;
                nestedClasses += '\n' + nestedCode.split('\n').map(line => indent + line).join('\n') + '\n';
            } else if (type.startsWith("List<") && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                const nestedClassName = capitalize(key);
                const nestedCode = generateClass(nestedClassName, value[0], indent + '   ');
                type = `List<${nestedClassName}>`;
                nestedClasses += '\n' + nestedCode.split('\n').map(line => indent + line).join('\n') + '\n';
            }

            classCode += `${indent}private ${type} ${key};\n`;

            gettersSetters +=
                `${indent}public ${type} get${capitalize(key)}() {\n` +
                `${indent}    return ${key};\n` +
                `${indent}}\n\n` +
                `${indent}public void set${capitalize(key)}(${type} ${key}) {\n` +
                `${indent}    this.${key} = ${key};\n` +
                `${indent}}\n\n`;
        }

        classCode += '\n' + gettersSetters + nestedClasses + '}\n';

        return classCode;
    }



    const generateCode = () => {
        if (!serviceName.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Missing Information',
                text: 'Please enter Service Name',
            });
            return;
        }
        if (!apiEndpoint.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Missing Information',
                text: 'Please enter API Endpoint URL',
            });
            return;
        }

        let requestPojoClasses = {};
        let responsePojoClasses = {};
        let errorResponsePojoClasses = {};

        try {
            requestPojoClasses = requestBody.trim()
                ? generateClass("RequestBody", JSON.parse(requestBody))
                : '';
        } catch {
            Swal.fire({
                icon: 'error',
                title: 'Invalid JSON',
                text: 'Invalid JSON in Request Body',
            });
            return;
        }

        try {
            responsePojoClasses = responseBody.trim()
                ? generateClass("SuccessResponseData", JSON.parse(responseBody))
                : '';
        } catch {
            Swal.fire({
                icon: 'error',
                title: 'Invalid JSON',
                text: 'Invalid JSON in Response Body',
            });
            return;
        }

        try {
            errorResponsePojoClasses = errorResponseBody.trim()
                ? generateClass("ErrorResponseData", JSON.parse(errorResponseBody))
                : '';
        } catch {
            Swal.fire({
                icon: 'error',
                title: 'Invalid JSON',
                text: 'Invalid JSON in Error Response Body',
            });
            return;
        }


        const requestPojo = requestPojoClasses;
        const responsePojo = responsePojoClasses;
        const errorResponsePojo = errorResponsePojoClasses;

        const methodLower = requestType.toLowerCase();

        const methodCode = `
    public Response ${methodLower}() {
        RequestSpecification requestSpecification = new baseRequestSpec().headers(new Headers());
        Response response = ${methodLower}(requestSpecification, endpointUrl);
        return response;
    }`;

        const mainCode = `import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import io.restassured.http.Headers;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

public class ${capitalize(serviceName)} extends BaseService {
    String endpointUrl = "${apiEndpoint}";

    public void ${capitalize(serviceName)}() {
        try {
            String appUrl = appConfig.get("yourfoldername", "configkey");
            hostAddress = new URL(appUrl);
        } catch (Exception ex) {
        }
    }

    public void setHeader(String key, String value) {
        headers.put(key, value);
    }
${methodCode}

    public SuccessResponseData getSuccessResponseData(Response response) {
        return response.as(SuccessResponseData.class);
    }
    
    public ErrorResponseData getErrorResponseData(Response response) {
        return response.as(ErrorResponseData.class);
    }
`;

        // Generate Step Definition
        const stepDefCode = `import io.cucumber.java.en.*;
import io.restassured.response.Response;
import org.testng.Assert;

public class ${capitalize(serviceName)}Steps {
    private ${capitalize(serviceName)} ${serviceName.toLowerCase()} = new ${capitalize(serviceName)}();
    private Response response;
    private SuccessResponseData successResponse;
    private ErrorResponseData errorResponse;

    @Given("the user send ${requestType.toLowerCase()} request to ${serviceName} service endpoint")
    public void sendRequestToServiceEndpoint() {
        response = ${serviceName.toLowerCase()}.${methodLower}();
    }

    @Then("the user should get status code as {int}")
    public void verifyStatusCode(int expectedStatusCode) {
        Assert.assertEquals(expectedStatusCode, response.getStatusCode());
    }

    @Then("the user verify the success schema of the response returned as expected for ${serviceName} service endpoint")
    public void verifySuccessSchema() {
        successResponse = ${serviceName.toLowerCase()}.getSuccessResponseData(response);
        Assert.assertNotNull(successResponse);
    }

    @And("the user verify the success response body should contain valid data for ${serviceName} service endpoint")
    public void verifySuccessResponseBody() {
        // Add specific assertions for success response fields here
        // Example: Assert.assertNotNull(successResponse.getFieldName());
    }

    @Then("the user verify the error schema of the response returned as expected for ${serviceName} service endpoint")
    public void verifyErrorSchema() {
        errorResponse = ${serviceName.toLowerCase()}.getErrorResponseData(response);
        Assert.assertNotNull(errorResponse);
    }

    @And("the user verify the error response body should contain valid data for ${serviceName} service endpoint")
    public void verifyErrorResponseBody() {
        // Add specific assertions for error response fields here
        // Example: Assert.assertNotNull(errorResponse.getErrorMessage());
    }
}`;

        // Generate Feature File
        const featureCode = `Feature: ${capitalize(serviceName)} API Tests

  Scenario: Verify successful ${requestType} request to ${serviceName}
    Given the user send ${requestType.toLowerCase()} request to ${serviceName} service endpoint
    Then the user should get status code as 200
    Then the user verify the success schema of the response returned as expected for ${serviceName} service endpoint
    And the user verify the success response body should contain valid data for ${serviceName} service endpoint

  Scenario: Verify error response for ${requestType} request to ${serviceName}
    Given the user send ${requestType.toLowerCase()} request to ${serviceName} service endpoint
    Then the user should get status code as 400
    Then the user verify the error schema of the response returned as expected for ${serviceName} service endpoint
    And the user verify the error response body should contain valid data for ${serviceName} service endpoint`;

        setGeneratedCode(
            [
                mainCode,
                requestPojo ? requestPojo + "\n\n" : "",
                responsePojo ? responsePojo + "\n\n" : "",
                errorResponsePojo ? errorResponsePojo : "",
                "\n}",
            ].join("")
        );

        setStepDefinition(stepDefCode);
        setFeatureFile(featureCode);

        // Show success notification
        toast.success('Code has been generated successfully! Please scroll down & look for generated code', {
            position: "bottom-center",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
        });
    };

    const handleData = (data) => {
        console.log(data);

        console.log(data.details.parameters);

        let requestBody = JSON.stringify(data.details.parameters);
        setServiceName(data.details.summary);
        setApiEndpoint(data.path);
        setRequestType(data.method);
        setHeaderKey("");
        setHeaderValue("");
        setHeaders([]);
        setBulkHeaders("");
        setRequestBody(requestBody);
        setResponseBody("");
        setErrorResponseBody("");
        setResponseCode("200");
        
    };

    const downloadCode = () => {
        if (!generatedCode) {
            Swal.fire({
                icon: 'error',
                title: 'No Code',
                text: 'No code to download!',
            });
            return;
        }
        const element = document.createElement("a");
        const file = new Blob([generatedCode], { type: "text/plain" });
        element.href = URL.createObjectURL(file);
        element.download = `${capitalize(serviceName) || "GeneratedService"}.java`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const downloadStepDefinition = () => {
        if (!stepDefinition) {
            Swal.fire({
                icon: 'error',
                title: 'No Step Definition',
                text: 'No step definition to download!',
            });
            return;
        }
        const element = document.createElement("a");
        const file = new Blob([stepDefinition], { type: "text/plain" });
        element.href = URL.createObjectURL(file);
        element.download = `${capitalize(serviceName) || "Generated"}Steps.java`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const downloadFeatureFile = () => {
        if (!featureFile) {
            Swal.fire({
                icon: 'error',
                title: 'No Feature File',
                text: 'No feature file to download!',
            });
            return;
        }
        const element = document.createElement("a");
        const file = new Blob([featureFile], { type: "text/plain" });
        element.href = URL.createObjectURL(file);
        element.download = `${capitalize(serviceName) || "Generated"}APITests.feature`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const [collapse, setCollapse] = useState({
        headers: false,
        request: false,
        success: false,
        error: false,
    });

    const toggleCollapse = (section) => {
        setCollapse({ ...collapse, [section]: !collapse[section] });
    };

    const CollapsibleSection = ({ title, sectionKey, children }) => (
        <div style={{
            marginBottom: 15,
            border: '1px solid #ddd',
            borderRadius: 6,
            overflow: 'hidden',
            fontFamily: 'Segoe UI, sans-serif'
        }}>
            <div
                onClick={() => toggleCollapse(sectionKey)}
                style={{
                    cursor: 'pointer',
                    backgroundColor: '#f6f8fa',
                    padding: '10px 15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #ddd',
                    fontWeight: 600
                }}
            >
                <span>{collapse[sectionKey] ? '▾' : '▸'} {title}</span>
            </div>
            {collapse[sectionKey] && (
                <div style={{ padding: 15 }}>{children}</div>
            )}
        </div>
    );

    const getAllFieldPaths = (obj, path = '') => {
        let paths = [];
        for (const [key, value] of Object.entries(obj)) {
            const fullPath = path ? `${path}.${key}` : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                paths = paths.concat(getAllFieldPaths(value, fullPath));
            } else {
                paths.push(fullPath);
            }
        }
        return paths;
    };

    const selectAllFields = () => setSelectedRequestFields(getAllFieldPaths(parsedRequestBody));
    const deselectAllFields = () => setSelectedRequestFields([]);


    const [selectedRequestFields, setSelectedRequestFields] = useState([]);
    const [parsedRequestBody, setParsedRequestBody] = useState({});

    const renderFieldCheckboxes = (obj, path = '') => {
        return Object.entries(obj).map(([key, value]) => {
            const fullPath = path ? `${path}.${key}` : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                return (
                    <div key={fullPath} style={{ marginLeft: path ? 20 : 0 }}>
                        <strong>{key}</strong>
                        <div>{renderFieldCheckboxes(value, fullPath)}</div>
                    </div>
                );
            } else {
                return (
                    <label key={fullPath} style={{ display: 'block', marginLeft: path ? 20 : 0 }}>
                        <input
                            type="checkbox"
                            checked={selectedRequestFields.includes(fullPath)}
                            onChange={() => toggleField(fullPath)}
                        /> {fullPath}
                    </label>
                );
            }
        });
    };


    return (
        <div style={{
            maxWidth: 1200,
            margin: "30px auto",
            padding: 20,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 6px 15px rgba(0,0,0,0.1)"
        }}>
            {/* Toast Container for notifications */}
            <ToastContainer
                position="top-left"
                autoClose={3000}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />

            <h2>API Automation Code Generator</h2>

            <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                <ImportFromSwagger onData={handleData} />
            </div>
            <div style={{ marginBottom: 15 }}>
                <label>Service Name</label>
                <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => {
                        const value = e.target.value;
                        if (!value.includes(' ')) {
                            setServiceName(value);
                        }
                    }}
                    placeholder="Enter service name"
                    style={{ width: "100%", padding: 8 }}
                />
            </div>

            <div style={{ marginBottom: 15 }}>
                <label>API Endpoint URL</label>
                <input
                    type="url"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder="/objects"
                    style={{ width: "100%", padding: 8 }}
                />
            </div>

            <div style={{ marginBottom: 15 }}>
                <label>Request Type</label>
                <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>DELETE</option>
                    <option>PATCH</option>
                    <option>HEAD</option>
                    <option>OPTIONS</option>
                </select>
            </div>

            <CollapsibleSection title="Request Headers" sectionKey="headers">
                <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
                    <input
                        type="text"
                        placeholder="Header Key"
                        value={headerKey}
                        onChange={(e) => setHeaderKey(e.target.value)}
                        style={{ flex: 1, padding: 8 }}
                    />
                    <input
                        type="text"
                        placeholder="Header Value"
                        value={headerValue}
                        onChange={(e) => setHeaderValue(e.target.value)}
                        style={{ flex: 1, padding: 8 }}
                    />
                    <button
                        type="button"
                        onClick={addHeader}
                        style={{
                            padding: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                        title="Add Header"
                    >
                        <FaPlus />
                    </button>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <textarea
                        rows={3}
                        placeholder="Bulk add headers (key:value per line)"
                        value={bulkHeaders}
                        onChange={(e) => setBulkHeaders(e.target.value)}
                        style={{
                            width: "100%",
                            fontFamily: "monospace",
                            padding: 8
                        }}
                    />
                    <button
                        type="button"
                        onClick={bulkAddHeaders}
                        style={{
                            padding: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: '#ff4444',
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            alignSelf: "flex-start"
                        }}
                        title="Bulk Import Headers"
                    >
                        <BiSelectMultiple size={16} />
                    </button>
                </div>

                {headers.length > 0 && (
                    <ul style={{ marginTop: 10 }}>
                        {headers.map((h, i) => (
                            <li key={i}><b>{h.key}</b>: {h.value}</li>
                        ))}
                    </ul>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Request Body" sectionKey="request">
                {viewMode.request === 'view' ? (
                    <div style={{ position: 'relative' }}>
                        <SyntaxHighlighter
                            language="json"
                            style={vscDarkPlus}
                            customStyle={{
                                fontSize: '14px',
                                borderRadius: '4px',
                                padding: '16px',
                                overflowX: 'auto',
                                backgroundColor: '#1e1e1e'
                            }}
                        >
                            {requestBody}
                        </SyntaxHighlighter>
                        <button
                            onClick={() => toggleEditMode('request')}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                padding: '6px',
                                background: '#ff4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Edit"
                        >
                            <FaEdit size={14} />
                        </button>
                    </div>
                ) : (
                    <textarea
                        rows={10}
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        placeholder="Enter JSON request body here"
                        style={{
                            width: "100%",
                            fontFamily: "monospace",
                            padding: 8
                        }}
                    />
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    {viewMode.request === 'edit' && (
                        <button
                            type="button"
                            onClick={() => formatJson(requestBody, setRequestBody, 'request')}
                            style={{ padding: "8px 16px" }}
                        >
                            Format JSON
                        </button>
                    )}
                </div>
                {viewMode.request === 'view' && Object.keys(parsedRequestBody).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                        <strong>Select Fields:</strong>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                            <button onClick={selectAllFields}>Select All</button>
                            <button onClick={deselectAllFields}>Select None</button>
                        </div>
                        <div style={{
                            maxHeight: '250px',
                            overflowY: 'auto',
                            padding: '10px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            backgroundColor: '#f9f9f9'
                        }}>
                            {renderFieldCheckboxes(parsedRequestBody)}
                        </div>
                    </div>

                )}
            </CollapsibleSection>

            <CollapsibleSection title="Success Response Body" sectionKey="success">
                {viewMode.response === 'view' ? (
                    <div style={{ position: 'relative' }}>
                        <SyntaxHighlighter
                            language="json"
                            style={vscDarkPlus}
                            customStyle={{
                                fontSize: '14px',
                                borderRadius: '4px',
                                padding: '16px',
                                overflowX: 'auto',
                                backgroundColor: '#1e1e1e'
                            }}
                        >
                            {responseBody}
                        </SyntaxHighlighter>
                        <button
                            onClick={() => toggleEditMode('response')}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                padding: '6px',
                                background: '#ff4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Edit"
                        >
                            <FaEdit size={14} />
                        </button>
                    </div>
                ) : (
                    <textarea
                        rows={10}
                        value={responseBody}
                        onChange={(e) => setResponseBody(e.target.value)}
                        placeholder="Enter JSON success response body here"
                        style={{
                            width: "100%",
                            fontFamily: "monospace",
                            padding: 8
                        }}
                    />
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    {viewMode.response === 'edit' && (
                        <button
                            type="button"
                            onClick={() => formatJson(responseBody, setResponseBody, 'response')}
                            style={{ padding: "8px 16px" }}
                        >
                            Format JSON
                        </button>
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Error Response Body" sectionKey="error">
                {viewMode.error === 'view' ? (
                    <div style={{ position: 'relative' }}>
                        <SyntaxHighlighter
                            language="json"
                            style={vscDarkPlus}
                            customStyle={{
                                fontSize: '14px',
                                borderRadius: '4px',
                                padding: '16px',
                                overflowX: 'auto',
                                backgroundColor: '#1e1e1e'
                            }}
                        >
                            {errorResponseBody}
                        </SyntaxHighlighter>
                        <button
                            onClick={() => toggleEditMode('error')}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                padding: '6px',
                                background: '#ff4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Edit"
                        >
                            <FaEdit size={14} />
                        </button>
                    </div>
                ) : (
                    <textarea
                        rows={10}
                        value={errorResponseBody}
                        onChange={(e) => setErrorResponseBody(e.target.value)}
                        placeholder="Enter JSON error response body here"
                        style={{
                            width: "100%",
                            fontFamily: "monospace",
                            padding: 8
                        }}
                    />
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    {viewMode.error === 'edit' && (
                        <button
                            type="button"
                            onClick={() => formatJson(errorResponseBody, setErrorResponseBody, 'error')}
                            style={{ padding: "8px 16px" }}
                        >
                            Format JSON
                        </button>
                    )}
                </div>
            </CollapsibleSection>

            <div style={{ marginBottom: 15 }}>
                <label>Response Code</label>
                <select
                    value={responseCode}
                    onChange={(e) => setResponseCode(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                >
                    {[100, 101, 102, 200, 201, 202, 204, 400, 401, 403, 404, 500, 502, 503].map((code) => (
                        <option key={code} value={code}>{code}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
                <button
                    type="button"
                    onClick={generateCode}
                    style={{
                        padding: "10px 16px",
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }}
                >
                    <FaCode /> Generate Code
                </button>
                <button
                    type="button"
                    onClick={clearAll}
                    style={{
                        padding: "10px 16px",
                        background: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }}
                >
                    <FaTrash /> Clear All
                </button>
            </div>

            {generatedCode && (
                <fieldset style={{ marginBottom: 20, padding: 15 }}>
                    <legend>Generated Java Service Code</legend>
                    <SyntaxHighlighter
                        language="java"
                        style={vscDarkPlus}
                        showLineNumbers={true}
                        customStyle={{
                            fontSize: '14px',
                            borderRadius: '4px',
                            padding: '16px',
                            overflowX: 'auto',
                            backgroundColor: '#1e1e1e'
                        }}
                    >
                        {generatedCode}
                    </SyntaxHighlighter>
                    <button
                        type="button"
                        onClick={downloadCode}
                        style={{
                            marginTop: 10,
                            padding: "8px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        <FaDownload /> Download Service Code
                    </button>
                </fieldset>
            )}

            {stepDefinition && (
                <fieldset style={{ marginBottom: 20, padding: 15 }}>
                    <legend>Step Definition File</legend>
                    <SyntaxHighlighter
                        language="java"
                        style={vscDarkPlus}
                        showLineNumbers={true}
                        customStyle={{
                            fontSize: '14px',
                            borderRadius: '4px',
                            padding: '16px',
                            overflowX: 'auto',
                            backgroundColor: '#1e1e1e'
                        }}
                    >
                        {stepDefinition}
                    </SyntaxHighlighter>
                    <button
                        type="button"
                        onClick={downloadStepDefinition}
                        style={{
                            marginTop: 10,
                            padding: "8px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        <FaDownload /> Download Step Definition
                    </button>
                </fieldset>
            )}

            {featureFile && (
                <fieldset style={{ marginBottom: 20, padding: 15 }}>
                    <legend>Feature File</legend>
                    <SyntaxHighlighter
                        language="gherkin"
                        style={vscDarkPlus}
                        showLineNumbers={true}
                        customStyle={{
                            fontSize: '14px',
                            borderRadius: '4px',
                            padding: '16px',
                            overflowX: 'auto',
                            backgroundColor: '#1e1e1e'
                        }}
                    >
                        {featureFile}
                    </SyntaxHighlighter>
                    <button
                        type="button"
                        onClick={downloadFeatureFile}
                        style={{
                            marginTop: 10,
                            padding: "8px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        <FaDownload /> Download Feature File
                    </button>
                </fieldset>
            )}
        </div>
    );
}

export default App;